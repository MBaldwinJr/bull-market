import { describe, expect, it } from "vitest";
import { canSubmitManualPaperOrder, MANUAL_PAPER_ORDER_UI_ENABLED } from "./manual-paper-order-activation";

const valid = {
  symbol: "BTCUSDT",
  quantity: "0.001",
  stopPrice: "50000",
  confirmation: "CONFIRMAR COMPRA SIMULADA",
  strategyKey: "ema",
};

describe("manual paper order activation", () => {
  it("is always locked in this release, including fully valid input", () => {
    expect(MANUAL_PAPER_ORDER_UI_ENABLED).toBe(false);
    expect(canSubmitManualPaperOrder(valid)).toBe(false);
  });
  it("rejects malformed input independently of the activation gate", () => {
    for (const patch of [
      { symbol: "btc/usdt" }, { quantity: "0" }, { quantity: "NaN" },
      { stopPrice: "" }, { strategyKey: "bad key" }, { confirmation: "SIM" },
    ]) {
      expect(canSubmitManualPaperOrder({ ...valid, ...patch })).toBe(false);
    }
  });
});
