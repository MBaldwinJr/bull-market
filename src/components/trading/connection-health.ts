import type { ExchangeHealth } from "@/features/market/services/market.functions";

export type ConnectionState = "ok" | "down" | "pending" | "unchecked";

/**
 * Reports each source separately. A successful Kraken BTC/USDT quote health
 * check does not imply Binance access or availability of every market/candle.
 */
export function marketConnectionStates(
  health: ExchangeHealth | undefined,
  isPending: boolean,
  isError: boolean,
): { binance: ConnectionState; kraken: ConnectionState } {
  if (isPending) return { binance: "pending", kraken: "pending" };
  if (isError || !health) return { binance: "down", kraken: "unchecked" };
  return {
    binance: health.binancePublic ? "ok" : "down",
    kraken: health.fallbackAvailable === true ? "ok" :
      health.failureReason === "http_error" ? "down" : "unchecked",
  };
}
