/**
 * Client-side, read-only checklist. This is NOT trading authorization:
 * authenticated server preflight and the database re-check every condition.
 * Missing records are never treated as permission to execute.
 */
export interface PaperReadinessInput {
  readonly symbol: string;
  readonly strategyKey: string;
  readonly account?: {
    readonly status: string; readonly source: string;
    readonly initial_balance: number; readonly cash_balance: number;
  } | null;
  readonly bot?: {
    readonly trading_mode: string; readonly status: string;
    readonly live_trading_enabled: boolean; readonly allow_withdrawals: boolean;
  } | null;
  readonly limits?: {
    readonly status: string; readonly leverage: number;
    readonly stop_loss_required: boolean;
  } | null;
  readonly assets?: ReadonlyArray<{
    readonly symbol: string; readonly status: string;
    readonly auto_trade_enabled: boolean; readonly deleted_at: string | null;
  }> | null;
  readonly strategies?: ReadonlyArray<{
    readonly strategy_key: string; readonly status: string; readonly enabled: boolean;
  }> | null;
}

export interface PaperReadinessResult {
  readonly status: "unverified" | "blocked" | "preflight_checkable";
  readonly messages: readonly string[];
}

export function assessPaperPreflightReadiness(data: PaperReadinessInput): PaperReadinessResult {
  if (!data.account || !data.bot || !data.limits || !data.assets || !data.strategies) {
    return { status: "unverified", messages: ["Configurações não verificadas. Confira a conexão e o login."] };
  }
  const messages: string[] = [];
  if (data.account.status !== "active" || data.account.source !== "paper") {
    messages.push("A conta de Paper Trading não está ativa.");
  }
  if (!Number.isFinite(Number(data.account.cash_balance)) ||
      Number(data.account.cash_balance) <= 0 ||
      !Number.isFinite(Number(data.account.initial_balance)) ||
      Number(data.account.initial_balance) <= 0) {
    messages.push("A conta não possui saldo virtual disponível e capital inicial válidos.");
  }
  if (data.bot.trading_mode !== "paper" ||
      data.bot.live_trading_enabled !== false ||
      data.bot.allow_withdrawals !== false) {
    messages.push("As configurações de segurança do robô não correspondem ao modo Paper.");
  }
  if (data.bot.status !== "running") {
    messages.push("A autorização de simulação do robô não está ativa.");
  }
  if (data.limits.status !== "active" || data.limits.leverage !== 0 ||
      data.limits.stop_loss_required !== true) {
    messages.push("Os limites de risco estão inativos ou incompatíveis com Paper Trading.");
  }
  if (!data.assets.some((asset) => asset.symbol === data.symbol &&
      asset.status === "active" && asset.deleted_at === null &&
      asset.auto_trade_enabled === true)) {
    messages.push(`O ativo ${data.symbol} não está habilitado para operações simuladas.`);
  }
  if (!data.strategies.some((strategy) => strategy.strategy_key === data.strategyKey &&
      strategy.status === "active" && strategy.enabled === true)) {
    messages.push(`A estratégia ${data.strategyKey} está desativada ou indisponível.`);
  }
  return messages.length
    ? { status: "blocked", messages }
    : { status: "preflight_checkable", messages: [
      "Configurações básicas presentes. O servidor ainda precisa validar cotação, risco, saldo e identidade.",
    ] };
}
