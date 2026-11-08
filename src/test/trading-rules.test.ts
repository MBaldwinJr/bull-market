import { describe, expect, it } from "vitest";
import { botConfigSchema, riskLimitsSchema } from "@/features/account/schemas";
import { assertNonLiveVenue, LiveTradingBlockedError, TRADING_LOCKS } from "@/lib/trading-config";
import { computeDashboardMetrics, maxDrawdownPct } from "@/features/dashboard/utils/metrics";
import { closedCandles, ema, rsi, scoreBand, type Candle } from "@/features/market/utils/indicators";

describe("live trading lock", () => {
  it("rejects live venue", () => {
    expect(() => assertNonLiveVenue("live")).toThrow(LiveTradingBlockedError);
  });
  it("allows paper venue", () => {
    expect(() => assertNonLiveVenue("paper")).not.toThrow();
  });
  it("ships with live trading disabled and withdrawals forbidden", () => {
    expect(TRADING_LOCKS.LIVE_TRADING_ENABLED).toBe(false);
    expect(TRADING_LOCKS.ALLOW_WITHDRAWALS).toBe(false);
    expect(TRADING_LOCKS.TRADING_MODE).toBe("paper");
  });
  it("bot config schema rejects enabling live trading", () => {
    expect(botConfigSchema.safeParse({ trading_mode: "paper", live_trading_enabled: true, allow_withdrawals: false }).success).toBe(false);
  });
});

describe("risk limits", () => {
  const base = { max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1, max_open_positions: 2, take_profit_pct: null };
  it("accepts PRD defaults (0.5% / 1% / 2 positions)", () => {
    expect(riskLimitsSchema.safeParse(base).success).toBe(true);
  });
  it("rejects risk per trade above 2%", () => {
    expect(riskLimitsSchema.safeParse({ ...base, max_risk_per_trade_pct: 2.5 }).success).toBe(false);
  });
});

describe("indicators", () => {
  it("drops the candle still forming", () => {
    const c = (closeTime: number): Candle => ({ openTime: 0, open: 1, high: 1, low: 1, close: 1, volume: 1, closeTime });
    expect(closedCandles([c(100), c(200)], 150)).toHaveLength(1);
  });
  it("EMA of a constant series equals the constant", () => {
    expect(ema([5, 5, 5, 5, 5], 3).at(-1)).toBe(5);
  });
  it("RSI is 100 for a strictly rising series", () => {
    expect(rsi(Array.from({ length: 20 }, (_, i) => i + 1), 14)).toBe(100);
  });
  it("score bands follow PRD ranges", () => {
    expect(scoreBand(39)).toBe("descartada");
    expect(scoreBand(60)).toBe("avaliacao");
    expect(scoreBand(90)).toBe("confluencia");
  });
});

describe("dashboard metrics", () => {
  it("max drawdown from 100 → 80 is 20%", () => {
    expect(maxDrawdownPct([100, 80, 90])).toBe(20);
  });
  it("risk used = (entry - stop) * qty / equity", () => {
    const m = computeDashboardMetrics({
      initialBalance: 1000,
      cash: 900,
      positions: [
        { symbol: "BTCUSDT", quantity: 1, entry_price: 100, stop_loss: 95, realized_pnl: null, fees_paid: 0, status: "open", strategy_key: null, closed_at: null },
      ],
      totalOrders: 1,
      equitySeries: [],
      today: "2026-11-08",
    });
    expect(m.equity).toBe(1000);
    expect(m.riskUsedPct).toBeCloseTo(0.5);
  });
});
