import { describe, expect, it } from "vitest";
import type { ExchangeHealth } from "@/features/market/services/market.functions";
import { marketConnectionStates } from "./connection-health";

const base: ExchangeHealth = { binancePublic: false, latencyMs: 307, checkedAt: 1 };

describe("market connection indicators", () => {
  it("reports Binance failure and separately verified Kraken BTC/USDT fallback", () => {
    expect(marketConnectionStates({
      ...base, failureReason: "http_error", httpStatus: 403,
      fallbackAvailable: true, fallbackSource: "kraken_public",
    }, false, false)).toEqual({ binance: "down", kraken: "ok" });
  });

  it("never marks Kraken verified from Binance success", () => {
    expect(marketConnectionStates({ ...base, binancePublic: true }, false, false))
      .toEqual({ binance: "ok", kraken: "unchecked" });
  });

  it("fails closed after both sources fail with an HTTP rejection", () => {
    expect(marketConnectionStates({ ...base, failureReason: "http_error",
      httpStatus: 403, fallbackAvailable: false }, false, false))
      .toEqual({ binance: "down", kraken: "down" });
  });

  it("avoids false connection claims when only network diagnostics fail", () => {
    expect(marketConnectionStates({ ...base, failureReason: "network" }, false, false))
      .toEqual({ binance: "down", kraken: "unchecked" });
    expect(marketConnectionStates(undefined, true, false))
      .toEqual({ binance: "pending", kraken: "pending" });
    expect(marketConnectionStates(undefined, false, true))
      .toEqual({ binance: "down", kraken: "unchecked" });
  });
});
