import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Candle } from "../utils/indicators";
import type { PublicTicker } from "../server/public-market-data.server";

// Public market-data mirror of Binance Spot. Only public endpoints: no keys, no orders.
const BINANCE_PUBLIC = "https://data-api.binance.vision/api/v3";
const SYMBOL = z.string().regex(/^[A-Z0-9]{2,20}$/);

export type Ticker = PublicTicker;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Binance respondeu ${res.status}`);
  return res.json();
}

export const getTickers = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ symbols: z.array(SYMBOL).min(1).max(50) }).parse(input))
  .handler(async ({ data }): Promise<Ticker[]> => {
    const { fetchPublicTickers } = await import("../server/public-market-data.server");
    return fetchPublicTickers(data.symbols);
  });

export const getCandles = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({
      symbol: SYMBOL,
      interval: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
      limit: z.number().int().min(30).max(1000).default(300),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<Candle[]> => {
    const { fetchPublicCandles } = await import("../server/public-market-data.server");
    return fetchPublicCandles(data.symbol, data.interval, data.limit);
  });

export const checkExchangeSymbol = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ symbol: SYMBOL }).parse(input))
  .handler(async ({ data }): Promise<{ base: string; quote: string } | null> => {
    const res = await fetch(`${BINANCE_PUBLIC}/exchangeInfo?symbol=${data.symbol}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { symbols?: Array<{ baseAsset: string; quoteAsset: string; status: string }> };
    const s = body.symbols?.[0];
    if (!s || s.status !== "TRADING") return null;
    return { base: s.baseAsset, quote: s.quoteAsset };
  });

export interface ExchangeHealth {
  readonly binancePublic: boolean;
  readonly latencyMs: number | null;
  readonly checkedAt: number;
  readonly failureReason?: "timeout" | "network" | "http_error" | "invalid_response";
  readonly httpStatus?: number;
  readonly fallbackAvailable?: boolean;
  readonly fallbackSource?: "kraken_public";
}

export const getExchangeHealth = createServerFn({ method: "GET" }).handler(async (): Promise<ExchangeHealth> => {
  const { fetchPublicSpotQuote } = await import("../server/public-spot-quote.server");
  const start = Date.now();
  try {
    // A successful ping alone is insufficient: trading requires valid prices.
    const res = await fetch(`${BINANCE_PUBLIC}/ticker/price?symbol=BTCUSDT`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      let fallbackAvailable = false;
      try {
        const quote = await fetchPublicSpotQuote("BTCUSDT");
        fallbackAvailable = quote.source === "kraken_public" && quote.price > 0;
      } catch { /* Fail closed: public prices unavailable. */ }
      return {
        binancePublic: false, latencyMs, checkedAt: Date.now(),
        failureReason: "http_error", httpStatus: res.status,
        fallbackAvailable, ...(fallbackAvailable ? { fallbackSource: "kraken_public" as const } : {}),
      };
    }
    const payload: unknown = await res.json();
    const valid = Boolean(payload && typeof payload === "object" &&
      (payload as Record<string, unknown>)["symbol"] === "BTCUSDT" &&
      typeof (payload as Record<string, unknown>)["price"] === "string" &&
      Number.isFinite(Number((payload as Record<string, unknown>)["price"])) &&
      Number((payload as Record<string, unknown>)["price"]) > 0);
    return {
      binancePublic: valid, latencyMs, checkedAt: Date.now(),
      ...(!valid ? { failureReason: "invalid_response" as const } : {}),
    };
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      binancePublic: false, latencyMs: Date.now() - start, checkedAt: Date.now(),
      failureReason: timeout ? "timeout" : "network",
    };
  }
});

export interface UsdBrlQuote {
  readonly usdBrl: number | null;
  readonly usdtBrl: number | null;
  readonly usdcUsdt: number | null;
  readonly fetchedAt: number;
  readonly referenceSource: string;
}

export const getDollarQuotes = createServerFn({ method: "GET" }).handler(async (): Promise<UsdBrlQuote> => {
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  const [ref, usdt, usdc] = await Promise.all([
    safe(async () => {
      const b = (await getJson("https://open.er-api.com/v6/latest/USD")) as { rates?: Record<string, number> };
      return b.rates?.["BRL"] ?? null;
    }),
    safe(async () => Number(((await getJson(`${BINANCE_PUBLIC}/ticker/price?symbol=USDTBRL`)) as { price: string }).price)),
    safe(async () => Number(((await getJson(`${BINANCE_PUBLIC}/ticker/price?symbol=USDCUSDT`)) as { price: string }).price)),
  ]);
  return { usdBrl: ref, usdtBrl: usdt, usdcUsdt: usdc, fetchedAt: Date.now(), referenceSource: "open.er-api.com" };
});
