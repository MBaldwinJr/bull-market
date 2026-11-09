import { MIN_PAPER_BUY_NOTIONAL_USDT } from "../utils/paper-order-policy";

/** Read-only indicative calculation. Never authorizes an order.
 * Actual eligibility is decided from a fresh trusted quote in the server
 * and checked again atomically by the paper-trading database function.
 */
export interface IndicativePaperRiskInput {
  readonly price: number | null;
  readonly quoteTimeMs: number | null;
  readonly nowMs: number;
  readonly quantity: number;
  readonly stopPrice: number;
  readonly initialBalance: number;
  readonly availableCash: number;
  readonly riskPct: number;
  readonly feeRate?: number;
}

export type IndicativePaperRisk =
  | { readonly status: "unavailable"; readonly reason: string }
  | {
      readonly status: "within_limit" | "rejected";
      readonly reason: string;
      readonly entry: number;
      readonly risk: number;
      readonly riskLimit: number;
      readonly lowestStop: number | null;
      readonly notional: number;
      readonly estimatedCost: number;
    };

export function estimatePaperRisk(input: IndicativePaperRiskInput): IndicativePaperRisk {
  const { price, quoteTimeMs, nowMs, quantity, stopPrice, initialBalance, availableCash, riskPct } = input;
  const feeRate = input.feeRate ?? 0.001;
  if (price === null || quoteTimeMs === null || !Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(quoteTimeMs) || !Number.isFinite(nowMs) ||
      nowMs - quoteTimeMs < 0 || nowMs - quoteTimeMs > 30_000) {
    return { status: "unavailable", reason: "Cotação de referência indisponível ou desatualizada." };
  }
  if (![quantity, stopPrice, initialBalance, availableCash, riskPct, feeRate].every(Number.isFinite) ||
      quantity <= 0 || initialBalance <= 0 || availableCash < 0 ||
      riskPct <= 0 || riskPct > 2 || feeRate < 0 || feeRate > 0.01) {
    return { status: "unavailable", reason: "Quantidade, saldo ou limites inválidos." };
  }
  const riskLimit = initialBalance * riskPct / 100;
  const risk = quantity * (price - stopPrice);
  const notional = quantity * price;
  const estimatedCost = notional * (1 + feeRate);
  const rawStopFloor = price - riskLimit / quantity;
  const lowestStop = rawStopFloor > 0 ? rawStopFloor : null;
  if (![risk, riskLimit, notional, estimatedCost, rawStopFloor].every(Number.isFinite)) {
    return { status: "unavailable", reason: "Não foi possível calcular o risco." };
  }
  const common = { entry: price, risk: Math.max(0, risk), riskLimit, lowestStop, estimatedCost, notional };
  if (stopPrice <= 0 || stopPrice >= price) return {
    status: "rejected",
    reason: "O stop-loss deve ser um preço positivo em USDT, abaixo do preço de entrada do BTC.",
    ...common,
  };
  if (notional < MIN_PAPER_BUY_NOTIONAL_USDT) return {
    status: "rejected",
    reason: `Valor simulado inferior ao mínimo de ${MIN_PAPER_BUY_NOTIONAL_USDT} USDT do Bull Market. Ajuste a quantidade.`,
    ...common,
  };
  if (risk > riskLimit) return {
    status: "rejected",
    reason: "Stop-loss distante demais: o risco estimado supera o limite por operação.",
    ...common,
  };
  if (estimatedCost > availableCash) return {
    status: "rejected",
    reason: "Saldo virtual insuficiente para a compra e a taxa estimada.",
    ...common,
  };
  return {
    status: "within_limit",
    reason: "Risco e saldo estimados dentro dos limites locais. A validação real ainda depende do servidor.",
    ...common,
  };
}
