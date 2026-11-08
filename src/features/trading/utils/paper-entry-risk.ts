/** Pure, fail-closed preflight for simulated long entries. No exchange or database writes. */
export interface PaperEntryInput {
  mode: string;
  liveTradingEnabled: boolean;
  withdrawalsEnabled: boolean;
  botStatus: string;
  marketFresh: boolean;
  balance: number;
  equity: number;
  dailyRealizedPnl: number;
  entryPrice: number;
  stopPrice: number;
  openPositions: number;
  maxOpenPositions: number;
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  proposedQuantity: number;
}
export type PaperEntryDecision =
  | { allowed: true; riskAmount: number; notional: number }
  | { allowed: false; reason: string };

export function evaluatePaperEntry(i: PaperEntryInput): PaperEntryDecision {
  const reject = (reason: string): PaperEntryDecision => ({ allowed: false, reason });
  if (i.mode !== "paper" || i.liveTradingEnabled || i.withdrawalsEnabled) return reject("Modo exclusivamente simulado obrigatório");
  if (i.botStatus !== "running") return reject("Robô não está em execução");
  if (!i.marketFresh) return reject("Cotação indisponível ou desatualizada");
  const values = [i.balance, i.equity, i.dailyRealizedPnl, i.entryPrice, i.stopPrice, i.openPositions, i.maxOpenPositions, i.maxRiskPerTradePct, i.maxDailyLossPct, i.proposedQuantity];
  if (values.some((v) => !Number.isFinite(v))) return reject("Valores inválidos");
  if (i.balance <= 0 || i.equity <= 0 || i.entryPrice <= 0 || i.proposedQuantity <= 0) return reject("Saldo, preço ou quantidade inválidos");
  if (i.stopPrice <= 0 || i.stopPrice >= i.entryPrice) return reject("Stop-loss obrigatório abaixo da entrada");
  if (!Number.isInteger(i.openPositions) || !Number.isInteger(i.maxOpenPositions) || i.openPositions < 0 || i.maxOpenPositions < 1 || i.openPositions >= i.maxOpenPositions) return reject("Limite de posições atingido");
  if (i.maxRiskPerTradePct <= 0 || i.maxRiskPerTradePct > 2 || i.maxDailyLossPct <= 0 || i.maxDailyLossPct > 5) return reject("Limites de risco inválidos");
  if (-i.dailyRealizedPnl >= i.equity * i.maxDailyLossPct / 100) return reject("Limite de perda diária atingido");
  const notional = i.proposedQuantity * i.entryPrice;
  const riskAmount = i.proposedQuantity * (i.entryPrice - i.stopPrice);
  if (!Number.isFinite(notional) || !Number.isFinite(riskAmount)) return reject("Cálculo inválido");
  if (notional > i.balance) return reject("Saldo insuficiente; alavancagem proibida");
  if (riskAmount > i.equity * i.maxRiskPerTradePct / 100) return reject("Risco por operação excedido");
  return { allowed: true, riskAmount, notional };
}
