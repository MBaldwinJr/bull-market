import { describe, expect, it } from "vitest";
import { estimatePaperRisk } from "./indicative-paper-risk";

const base = {
  price: 75000, quoteTimeMs: 100_000, nowMs: 100_500,
  quantity: 0.001, stopPrice: 74700,
  initialBalance: 100, availableCash: 100,
  riskPct: 0.5, feeRate: 0.001,
};

describe("indicative paper risk, never trade authorization", () => {
  it("explains stop 0.002 USDT is effectively total position loss", () => {
    const result = estimatePaperRisk({ ...base, stopPrice: 0.002 });
    expect(result.status).toBe("rejected");
    if (result.status === "unavailable") throw new Error("expected numeric estimate");
    expect(result.risk).toBeCloseTo(74.999998);
    expect(result.riskLimit).toBeCloseTo(0.5);
    expect(result.lowestStop).toBeCloseTo(74500);
  });

  it("rejects dust sized BTC order and never recommends a negative stop floor", () => {
    const r = estimatePaperRisk({ ...base, quantity: 0.0000001, stopPrice: 0.0000001 });
    expect(r.status).toBe("rejected");
    if (r.status === "unavailable") throw new Error("missing estimate");
    expect(r.notional).toBeCloseTo(0.0075);
    expect(r.lowestStop).toBeNull();
    expect(r.reason).toContain("mínimo de 5 USDT");
  });

  it("accepts meaningful simulated orders above the internal 5 USDT minimum", () => {
    const r = estimatePaperRisk({ ...base, quantity: 0.0001, stopPrice: 74700 });
    expect(r.status).toBe("within_limit");
    if (r.status === "unavailable") throw new Error("missing estimate");
    expect(r.notional).toBeCloseTo(7.5);
  });

  it("calculates 0.001 BTC 300 USDT stop distance as 0.30 risk", () => {
    const result = estimatePaperRisk(base);
    expect(result.status).toBe("within_limit");
    if (result.status === "unavailable") throw new Error("expected numeric estimate");
    expect(result.risk).toBeCloseTo(0.3);
    expect(result.estimatedCost).toBeCloseTo(75.075);
  });

  it("never treats stale quotes as permission", () => {
    expect(estimatePaperRisk({ ...base, nowMs: 131_000 }).status).toBe("unavailable");
    expect(estimatePaperRisk({ ...base, price: null }).status).toBe("unavailable");
    expect(estimatePaperRisk({ ...base, quoteTimeMs: null }).status).toBe("unavailable");
  });

  it("rejects stops above entry and negative quantities", () => {
    expect(estimatePaperRisk({ ...base, stopPrice: 75001 }).status).toBe("rejected");
    expect(estimatePaperRisk({ ...base, quantity: -0.001 }).status).toBe("unavailable");
  });

  it("rejects a purchase when fees exceed cash", () => {
    const result = estimatePaperRisk({ ...base, availableCash: 75 });
    expect(result.status).toBe("rejected");
    expect(result.reason).toContain("Saldo");
  });
});
