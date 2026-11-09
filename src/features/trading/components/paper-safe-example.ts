import { estimatePaperRisk } from "./indicative-paper-risk";

/**
 * Constructs a conservative, temporary example for the preparation-only form.
 * Does not place an order, authorize trading, change configuration, or fetch data.
 * Uses only an already-verified, fresh public ticker and current paper limits.
 */
export function examplePaperBuyFields(input: {
  readonly symbol: string;
  readonly price: number | null;
  readonly quoteTimeMs: number | null;
  readonly nowMs: number;
  readonly initialBalance: number;
  readonly availableCash: number;
  readonly riskPct: number;
}): { quantity: string; stopPrice: string } | null {
  if (!["BTCUSDT", "ETHUSDT"].includes(input.symbol) ||
      input.price === null || !Number.isFinite(input.price) || input.price <= 0 ||
      input.quoteTimeMs === null || !Number.isFinite(input.quoteTimeMs) ||
      !Number.isFinite(input.nowMs) ||
      input.nowMs - input.quoteTimeMs < 0 || input.nowMs - input.quoteTimeMs > 30_000 ||
      !Number.isFinite(input.initialBalance) || input.initialBalance <= 0 ||
      !Number.isFinite(input.availableCash) || input.availableCash <= 0 ||
      !Number.isFinite(input.riskPct) || input.riskPct <= 0 || input.riskPct > 2) {
    return null;
  }

  // Around 25 USDT with a substantial cash cushion for fees and quote movement.
  // Quantity is rounded DOWN to 8 decimals so the estimate never overspends
  // because of quantity rounding.
  const targetNotional = Math.min(25, input.availableCash / 2);
  const quantity = Math.floor((targetNotional / input.price) * 1e8) / 1e8;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const riskBudget = input.initialBalance * input.riskPct / 100;
  // The example uses at most a 0.5% price gap, and at most half of the
  // configured risk budget. The stop is rounded UP to cents (safer than down).
  const stopDistance = Math.min(input.price * 0.005, riskBudget / (2 * quantity));
  const stopPrice = Math.ceil((input.price - stopDistance) * 100) / 100;
  if (!(stopPrice > 0 && stopPrice < input.price)) return null;

  const check = estimatePaperRisk({
    price: input.price, quoteTimeMs: input.quoteTimeMs, nowMs: input.nowMs,
    quantity, stopPrice, initialBalance: input.initialBalance,
    availableCash: input.availableCash, riskPct: input.riskPct,
  });
  if (check.status !== "within_limit") return null;
  return { quantity: String(quantity), stopPrice: stopPrice.toFixed(2) };
}
