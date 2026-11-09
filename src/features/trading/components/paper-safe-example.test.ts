import { describe, expect, it } from "vitest";
import { examplePaperBuyFields } from "./paper-safe-example";
import { estimatePaperRisk } from "./indicative-paper-risk";

const reference = {
  symbol: "BTCUSDT", price: 75059.2, quoteTimeMs: 100_000,
  nowMs: 100_500, initialBalance: 100, availableCash: 100, riskPct: 0.5,
};

describe("paper-only example fill", () => {
  it("suggests a meaningful funded example without claiming to authorize an order", () => {
    const suggestion = examplePaperBuyFields(reference);
    expect(suggestion).not.toBeNull();
    const qty = Number(suggestion!.quantity);
    const stop = Number(suggestion!.stopPrice);
    expect(qty * reference.price).toBeGreaterThanOrEqual(5);
    expect(qty * reference.price).toBeLessThanOrEqual(25);
    expect(stop).toBeLessThan(reference.price);
    const estimate = estimatePaperRisk({
      ...reference, quantity: qty, stopPrice: stop,
    });
    expect(estimate.status).toBe("within_limit");
  });

  it("allows ETH/USDT while protecting the same fictitious cash", () => {
    const suggestion = examplePaperBuyFields({ ...reference, symbol: "ETHUSDT", price: 2300 });
    expect(suggestion).not.toBeNull();
    expect(Number(suggestion!.quantity) * 2300).toBeGreaterThanOrEqual(5);
  });

  it("never invents an example without a fresh real quote", () => {
    expect(examplePaperBuyFields({ ...reference, quoteTimeMs: null })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, nowMs: 200_000 })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, price: null })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, price: 0 })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, symbol: "SOLUSDT" })).toBeNull();
  });

  it("does not invent viable examples on very low cash or invalid risk settings", () => {
    expect(examplePaperBuyFields({ ...reference, availableCash: 3 })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, riskPct: 0 })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, riskPct: 5 })).toBeNull();
    expect(examplePaperBuyFields({ ...reference, initialBalance: 0 })).toBeNull();
  });

  it("respects very tight risk settings without negative stops", () => {
    const suggestion = examplePaperBuyFields({ ...reference, riskPct: 0.001 });
    expect(suggestion).not.toBeNull();
    const result = estimatePaperRisk({
      ...reference, riskPct: 0.001,
      quantity: Number(suggestion!.quantity), stopPrice: Number(suggestion!.stopPrice),
    });
    expect(result.status).toBe("within_limit");
  });
});
