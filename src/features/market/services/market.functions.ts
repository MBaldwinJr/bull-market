import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Candle } from "../utils/indicators";

// Public market-data mirror of Binance Spot. Only public endpoints: no keys, no orders.
const BINANCE_PUBLIC = "https://data-api.binance.vision/api/v3";
const SYMBOL = z.string().regex(/^[A-Z0-9]{2,20}$/);

export interface Ticker {
  readonly symbol: string;
  readonly lastPrice: number;
  readonly changePct: number;
  readonly high: number;
  readonly low: number;
  readonly quoteVolume: number;
  readonly bid: number;
  readonly ask: number;
  readonly spreadPct: number;
  readonly fetchedAt: number;
}

interface RawTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
  bidPrice: string;
  askPrice: string;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Binance respondeu ${res.status}`);
  return res.json();
}

export const getTickers = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ symbols: z.array(SYMBOL).min(1).max(50) }).parse(input))
  .handler(async ({ data }): Promise<Ticker[]> => {
    const url = `${BINANCE_PUBLIC}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(data.symbols))}`;
    const raw = (await getJson(url)) as RawTicker[];
    const now = Date.now();
    return raw.map((t) => {
      const bid = Number(t.bidPrice);
      const ask = Number(t.askPrice);
      const mid = (bid + ask) / 2;
      return {
        symbol: t.symbol,
        lastPrice: Number(t.lastPrice),
        changePct: Number(t.priceChangePercent),
        high: Number(t.highPrice),
        low: Number(t.lowPrice),
        quoteVolume: Number(t.quoteVolume),
        bid,
        ask,
        spreadPct: mid > 0 ? ((ask - bid) / mid) * 100 : 0,
        fetchedAt: now,
      };
    });
  });

export const getCandles = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        symbol: SYMBOL,
        interval: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
        limit: z.number().int().min(30).max(1000).default(300),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Candle[]> => {
    const url = `${BINANCE_PUBLIC}/klines?symbol=${data.symbol}&interval=${data.interval}&limit=${data.limit}`;
    const raw = (await getJson(url)) as Array<[number, string, string, string, string, string, number]>;
    return raw.map((k) => ({
      openTime: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      closeTime: k[6],
    }));
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
}

export const getExchangeHealth = createServerFn({ method: "GET" }).handler(async (): Promise<ExchangeHealth> => {
  const start = Date.now();
  try {
    const res = await fetch(`${BINANCE_PUBLIC}/ping`);
    return { binancePublic: res.ok, latencyMs: Date.now() - start, checkedAt: Date.now() };
  } catch {
    return { binancePublic: false, latencyMs: null, checkedAt: Date.now() };
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
