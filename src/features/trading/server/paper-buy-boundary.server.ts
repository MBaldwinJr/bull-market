import type { BotConfig, RiskLimits, PaperAccount, PaperPosition, Strategy, Asset } from "@/features/account/services/account-service";
import { paperBuyRequestSchema } from "../services/paper-buy-schema";
import { planPaperBuy } from "../utils/paper-execution-plan";
import type { TrustedPaperQuote } from "./trusted-paper-quote";

export interface PaperBuyState {
  readonly bot: BotConfig;
  readonly limits: RiskLimits;
  readonly account: PaperAccount;
  readonly positions: readonly PaperPosition[];
  readonly strategies: readonly Strategy[];
  readonly assets: readonly Asset[];
  readonly duplicateOrder: boolean;
}

export interface PaperBuyDependencies {
  /** Must revalidate the bearer session with Auth, never a browser owner field. */
  readonly verifiedUserId: () => Promise<string>;
  readonly serviceCredentialsAvailable: () => boolean;
  readonly loadState: (ownerId: string, clientOrderId: string) => Promise<PaperBuyState>;
  readonly quote: (symbol: string) => Promise<TrustedPaperQuote>;
  readonly now: () => number;
}

/** Matches migration 0002; intentionally no RPC executor is supplied or invoked. */
export interface PreparedPaperBuy {
  readonly rpc: "execute_paper_buy";
  readonly args: {
    readonly p_owner_id: string;
    readonly p_client_order_id: string;
    readonly p_symbol: string;
    readonly p_strategy_key: string;
    readonly p_quantity: number;
    readonly p_entry_price: number;
    readonly p_stop_loss: number;
    readonly p_fee_rate: number;
    readonly p_quote_at: string;
  };
  readonly fee: number;
  readonly totalDebit: number;
}

const PAPER_FEE_RATE = 0.001;
const MAX_QUOTE_AGE_MS = 30_000;

export async function prepareAuthenticatedPaperBuy(
  input: unknown,
  dependencies: PaperBuyDependencies,
): Promise<PreparedPaperBuy> {
  const request = paperBuyRequestSchema.parse(input);
  const ownerId = await dependencies.verifiedUserId();
  if (!ownerId) throw new Error("Sessão inválida");
  if (!dependencies.serviceCredentialsAvailable()) throw new Error("Credenciais de serviço indisponíveis; execução bloqueada");
  const state = await dependencies.loadState(ownerId, request.clientOrderId);
  const rows = [state.bot, state.limits, state.account, ...state.positions, ...state.assets, ...state.strategies];
  if (rows.some((row) => row.owner_id !== ownerId)) throw new Error("Registros fora da conta autenticada");
  if (state.positions.some((position) => position.account_id !== state.account.id)) throw new Error("Posição de outra conta");
  if (state.duplicateOrder) throw new Error("Identificador de ordem duplicado");
  if (state.account.status !== "active" || state.account.source !== "paper" || state.limits.status !== "active") throw new Error("Conta ou limites inativos");
  if (state.limits.leverage !== 0 || state.limits.stop_loss_required !== true) throw new Error("Alavancagem proibida e stop-loss obrigatório");
  if (!state.assets.some((asset) => asset.symbol === request.symbol && asset.auto_trade_enabled === true && asset.status === "active" && asset.deleted_at === null)) throw new Error("Ativo não autorizado");
  if (!state.strategies.some((strategy) => strategy.strategy_key === request.strategyKey && strategy.enabled === true && strategy.status === "active")) throw new Error("Estratégia não autorizada");

  const dayStart = new Date(dependencies.now());
  dayStart.setUTCHours(0, 0, 0, 0);
  let dailyRealizedPnl = 0;
  for (const position of state.positions) {
    if (position.source !== "paper" || !["open", "closed"].includes(position.status)) throw new Error("Estado de posição inválido");
    if (position.status !== "closed") continue;
    const closedAt = Date.parse(position.closed_at ?? "");
    if (!Number.isFinite(closedAt) || closedAt > dependencies.now() || position.realized_pnl === null || !Number.isFinite(position.realized_pnl)) throw new Error("Resultado realizado inválido");
    if (closedAt >= dayStart.getTime()) dailyRealizedPnl += position.realized_pnl;
  }
  const quote = await dependencies.quote(request.symbol);
  const quoteAge = dependencies.now() - Date.parse(quote.fetchedAt);
  if (quote.symbol !== request.symbol || !Number.isFinite(quoteAge) || quoteAge < 0 || quoteAge > MAX_QUOTE_AGE_MS) throw new Error("Cotação indisponível ou desatualizada");
  const plan = planPaperBuy({
    mode: state.bot.trading_mode,
    liveTradingEnabled: state.bot.live_trading_enabled,
    withdrawalsEnabled: state.bot.allow_withdrawals,
    botStatus: state.bot.status,
    marketFresh: true,
    balance: state.account.cash_balance,
    // Migration 0002 uses opening capital as the risk/day-loss denominator.
    equity: state.account.initial_balance,
    dailyRealizedPnl,
    entryPrice: quote.price,
    stopPrice: request.stopPrice,
    proposedQuantity: request.quantity,
    openPositions: state.positions.filter((position) => position.status === "open").length,
    maxOpenPositions: state.limits.max_open_positions,
    maxRiskPerTradePct: state.limits.max_risk_per_trade_pct,
    maxDailyLossPct: state.limits.max_daily_loss_pct,
    symbol: request.symbol,
    feeRate: PAPER_FEE_RATE,
  });
  if (!plan.allowed) throw new Error(plan.reason);
  return {
    rpc: "execute_paper_buy",
    args: {
      p_owner_id: ownerId, p_client_order_id: request.clientOrderId,
      p_symbol: request.symbol, p_strategy_key: request.strategyKey,
      p_quantity: plan.quantity, p_entry_price: plan.entryPrice,
      p_stop_loss: plan.stopPrice, p_fee_rate: PAPER_FEE_RATE, p_quote_at: quote.fetchedAt,
    },
    fee: plan.fee, totalDebit: plan.totalDebit,
  };
}