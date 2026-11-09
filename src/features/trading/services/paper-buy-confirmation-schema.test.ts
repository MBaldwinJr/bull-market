import { describe, expect, it } from "vitest";
import { confirmedPaperBuySchema } from "./paper-buy-confirmation-schema";

const order = {
  clientOrderId: "paper-order-0001",
  symbol: "BTCUSDT",
  strategyKey: "ema",
  quantity: 0.1,
  stopPrice: 49,
};

describe("paper buy manual confirmation", () => {
  it("rejects orders without the explicit confirmation", () => {
    expect(confirmedPaperBuySchema.safeParse(order).success).toBe(false);
    expect(confirmedPaperBuySchema.safeParse({ ...order, confirmation: "SIM" }).success).toBe(false);
  });

  it("accepts the exact confirmation phrase", () => {
    expect(confirmedPaperBuySchema.safeParse({
      ...order, confirmation: "CONFIRMAR COMPRA SIMULADA",
    }).success).toBe(true);
  });

  it("rejects extra owner or price fields from the browser", () => {
    expect(confirmedPaperBuySchema.safeParse({
      ...order, confirmation: "CONFIRMAR COMPRA SIMULADA", ownerId: "someone-else",
    }).success).toBe(false);
  });
});
