import { describe, expect, it, vi } from "vitest";
import { prepareTrustedPaperBuy } from "./prepare-trusted-paper-buy";

vi.mock("./trusted-paper-quote", () => ({
  fetchTrustedPaperQuote: vi.fn(async () => ({ symbol: "BTCUSDT", price: 50, fetchedAt: new Date().toISOString() })),
}));

const base = {
  symbol: "BTCUSDT",
  feeRate: 0.001,
  mode: "paper",
  liveTradingEnabled: false,
  withdrawalsEnabled: false,
  botStatus: "running",
  balance: 100,
  equity: 100,
  dailyRealizedPnl: 0,
  stopPrice: 49.5,
  openPositions: 0,
  maxOpenPositions: 2,
  maxRiskPerTradePct: 0.5,
  maxDailyLossPct: 1,
  proposedQuantity: 1,
};
describe("trusted paper execution preflight", () => {
  it("plans a simulated entry from a trusted price", async () => {
    const result = await prepareTrustedPaperBuy(base);
    expect(result.plan.allowed).toBe(true);
    if (result.plan.allowed) expect(result.plan.entryPrice).toBe(50);
  });
  it("rejects live trading even when a valid quote exists", async () => {
    const result = await prepareTrustedPaperBuy({ ...base, liveTradingEnabled: true });
    expect(result.plan.allowed).toBe(false);
  });
  it("rejects stopped bots", async () => {
    const result = await prepareTrustedPaperBuy({ ...base, botStatus: "stopped" });
    expect(result.plan.allowed).toBe(false);
  });
});
