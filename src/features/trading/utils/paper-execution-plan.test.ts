import { describe, expect, it } from "vitest";
import { planPaperBuy } from "./paper-execution-plan";
import type { PaperEntryInput } from "./paper-entry-risk";

const input: PaperEntryInput & { symbol: string; feeRate: number } = {
  mode: "paper", liveTradingEnabled: false, withdrawalsEnabled: false, botStatus: "running",
  marketFresh: true, balance: 100, equity: 100, dailyRealizedPnl: 0,
  entryPrice: 50, stopPrice: 49.5, proposedQuantity: 1,
  openPositions: 0, maxOpenPositions: 2, maxRiskPerTradePct: 0.5, maxDailyLossPct: 1,
  symbol: "BTCUSDT", feeRate: 0.001,
};
describe("paper buy execution planner", () => {
  it("calculates fee, debit and remaining virtual cash", () => {
    expect(planPaperBuy(input)).toEqual({
      allowed: true, symbol: "BTCUSDT", quantity: 1, entryPrice: 50,
      stopPrice: 49.5, fee: 0.05, totalDebit: 50.05, cashAfter: 49.95, riskAmount: 0.5,
    });
  });
  it("rejects purchases whose fees exceed cash", () => {
    expect(planPaperBuy({ ...input, proposedQuantity: 2 })).toMatchObject({
      allowed: false, reason: "Saldo insuficiente para taxa e compra",
    });
  });
  it("rejects emergency stop and stale market", () => {
    expect(planPaperBuy({ ...input, botStatus: "emergency_stopped" }).allowed).toBe(false);
    expect(planPaperBuy({ ...input, marketFresh: false }).allowed).toBe(false);
  });
  it("rejects invalid symbol and fee", () => {
    expect(planPaperBuy({ ...input, symbol: "BTC/USDT" }).allowed).toBe(false);
    expect(planPaperBuy({ ...input, feeRate: -0.01 }).allowed).toBe(false);
  });
});
