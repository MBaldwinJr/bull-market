import { describe, expect, it } from "vitest";
import { computeDashboardMetrics } from "./metrics";

const base = {
  positions: [],
  totalOrders: 0,
  equitySeries: [],
  today: "2026-11-08",
} as const;

describe("paper dashboard opening balance", () => {
  it("displays full virtual cash and zero return before any orders", () => {
    const metrics = computeDashboardMetrics({ ...base, initialBalance: 10, cash: 10 });
    expect(metrics.cash).toBe(10);
    expect(metrics.equity).toBe(10);
    expect(metrics.totalPnl).toBe(0);
    expect(metrics.dailyPnl).toBe(0);
    expect(metrics.returnPct).toBe(0);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.openPositions).toBe(0);
  });

  it("exposes the missing database cash mirror instead of hiding it", () => {
    const metrics = computeDashboardMetrics({ ...base, initialBalance: 10, cash: 0 });
    expect(metrics.equity).toBe(0);
    expect(metrics.returnPct).toBe(-100);
  });

  it("does not divide by zero for an unconfigured account", () => {
    const metrics = computeDashboardMetrics({ ...base, initialBalance: 0, cash: 0 });
    expect(metrics.returnPct).toBe(0);
  });
});
