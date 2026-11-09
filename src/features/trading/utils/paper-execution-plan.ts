import { evaluatePaperEntry, type PaperEntryInput } from "./paper-entry-risk";
import { MIN_PAPER_BUY_NOTIONAL_USDT } from "./paper-order-policy";

/** Deterministic execution plan. Caller must revalidate under a DB row lock. */
export type PaperExecutionPlan =
  | { allowed: false; reason: string }
  | {
      allowed: true;
      symbol: string;
      quantity: number;
      entryPrice: number;
      stopPrice: number;
      fee: number;
      totalDebit: number;
      cashAfter: number;
      riskAmount: number;
    };

export function planPaperBuy(
  input: PaperEntryInput & { symbol: string; feeRate: number },
): PaperExecutionPlan {
  if (!/^[A-Z0-9]{2,20}$/.test(input.symbol)) return { allowed: false, reason: "Símbolo inválido" };
  if (!Number.isFinite(input.feeRate) || input.feeRate < 0 || input.feeRate > 0.01)
    return { allowed: false, reason: "Taxa inválida" };
  const decision = evaluatePaperEntry(input);
  if (!decision.allowed) return decision;
  if (decision.notional < MIN_PAPER_BUY_NOTIONAL_USDT)
    return { allowed: false, reason: "Valor simulado inferior ao mínimo de 5 USDT" };
  const fee = decision.notional * input.feeRate;
  const totalDebit = decision.notional + fee;
  if (!Number.isFinite(totalDebit) || totalDebit > input.balance)
    return { allowed: false, reason: "Saldo insuficiente para taxa e compra" };
  return {
    allowed: true,
    symbol: input.symbol,
    quantity: input.proposedQuantity,
    entryPrice: input.entryPrice,
    stopPrice: input.stopPrice,
    fee,
    totalDebit,
    cashAfter: input.balance - totalDebit,
    riskAmount: decision.riskAmount,
  };
}
