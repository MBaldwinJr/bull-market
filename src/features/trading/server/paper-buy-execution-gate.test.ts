import { describe, expect, it } from "vitest";
import { executePreparedPaperBuy } from "./paper-buy-execution-gate.server";
import type { PreparedPaperBuy } from "./paper-buy-boundary.server";

describe("paper buy execution gate", () => {
  it("always fails closed without invoking RPC", () => {
    const receipt = executePreparedPaperBuy({} as PreparedPaperBuy);
    expect(receipt).toMatchObject({ status: "execution_disabled", executed: false });
  });

  it("remains disabled for a fully populated prepared order", () => {
    const prepared = {
      ownerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      clientOrderId: "prepared-valid-order-001",
      symbol: "BTCUSDT",
      strategyKey: "ema",
      quantity: 0.5,
      entryPrice: 50,
      stopLoss: 49.75,
      feeRate: 0.001,
      quoteAt: new Date().toISOString(),
    } as unknown as PreparedPaperBuy;
    const original = JSON.stringify(prepared);
    const receipt = executePreparedPaperBuy(prepared);
    expect(receipt).toEqual({
      status: "execution_disabled",
      executed: false,
      reason: expect.stringContaining("migration 0002"),
    });
    expect(JSON.stringify(prepared)).toBe(original);
  });

  it("does not invoke getters on untrusted prepared payloads", () => {
    const payload = Object.defineProperty({}, "ownerId", {
      get() { throw new Error("Prepared order must not be inspected by the disabled gate"); },
    }) as PreparedPaperBuy;
    expect(() => executePreparedPaperBuy(payload)).not.toThrow();
    expect(executePreparedPaperBuy(payload).executed).toBe(false);
  });
});
