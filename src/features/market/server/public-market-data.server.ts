import type { Candle } from "../utils/indicators";

export type MarketProvider = "binance_public" | "kraken_public";
export type MarketInterval = "15m" | "1h" | "4h" | "1d";

export interface PublicTicker {
  readonly symbol: string;
  readonly lastPrice: number;
  readonly changePct: number;
  readonly changeBasis: "rolling_24h" | "today_open";
  readonly high: number;
  readonly low: number;
  readonly quoteVolume: number;
  readonly quoteVolumeEstimated: boolean;
  readonly bid: number;
  readonly ask: number;
  readonly spreadPct: number;
  readonly fetchedAt: number;
  readonly source: MarketProvider;
}

export interface PublicCandle extends Candle {
  readonly source: MarketProvider;
}

const BINANCE = "https://data-api.binance.vision/api/v3";
const KRAKEN = "https://api.kraken.com/0/public";
const SYMBOL = /^[A-Z0-9]{2,20}$/;
const PERIOD_MINUTES: Record<MarketInterval, number> = { "15m": 15, "1h": 60, "4h": 240, "1d": 1440 };
const KRAKEN_PAIRS: Record<string, { request: string; result: readonly string[] }> = {
  BTCUSDT: { request: "XBTUSDT", result: ["XBTUSDT", "XXBTUSDT"] },
  ETHUSDT: { request: "ETHUSDT", result: ["ETHUSDT", "XETHUSDT"] },
};

async function json(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Dados públicos indisponíveis: HTTP ${response.status}`);
  return response.json();
}

function positive(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Número ausente");
  if (typeof value === "string" && !value.trim()) throw new Error("Número vazio");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Preço inválido");
  return parsed;
}

function nonnegative(value: unknown): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) :
    typeof value === "number" ? value : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Volume inválido");
  return parsed;
}

function krakenResponse(payload: unknown, symbol: string): Record<string, unknown> {
  const pair = KRAKEN_PAIRS[symbol];
  if (!pair || !payload || typeof payload !== "object") throw new Error("Par Kraken não suportado");
  const value = payload as { error?: unknown; result?: unknown };
  if (!Array.isArray(value.error) || value.error.length || !value.result || typeof value.result !== "object") {
    throw new Error("Resposta Kraken inválida");
  }
  const entries = Object.entries(value.result as Record<string, unknown>).filter(([key]) => key !== "last");
  if (entries.length !== 1 || !pair.result.includes(entries[0]![0]) ||
      !entries[0]![1] || typeof entries[0]![1] !== "object") {
    throw new Error("Par de mercado divergente");
  }
  return entries[0]![1] as Record<string, unknown>;
}

function tickerFromKraken(payload: unknown, symbol: string): PublicTicker {
  const ticker = krakenResponse(payload, symbol);
  const array = (key: string) => {
    const values = ticker[key];
    if (!Array.isArray(values) || values.length < 2) throw new Error("Ticker incompleto");
    return values as unknown[];
  };
  const lastPrice = positive(array("c")[0]);
  const bid = positive(array("b")[0]);
  const ask = positive(array("a")[0]);
  const high = positive(array("h")[1]);
  const low = positive(array("l")[1]);
  const volume24h = nonnegative(array("v")[1]);
  const vwap24h = positive(array("p")[1]);
  const dayOpen = positive(ticker["o"]);
  if (low > high || bid > ask) throw new Error("Ticker inconsistente");
  const mid = (bid + ask) / 2;
  return {
    symbol, lastPrice, changePct: ((lastPrice / dayOpen) - 1) * 100,
    changeBasis: "today_open", high, low,
    quoteVolume: volume24h * vwap24h, quoteVolumeEstimated: true,
    bid, ask, spreadPct: ((ask - bid) / mid) * 100,
    fetchedAt: Date.now(), source: "kraken_public",
  };
}

function tickerFromBinance(value: unknown, symbol: string): PublicTicker {
  if (!value || typeof value !== "object") throw new Error("Ticker Binance inválido");
  const t = value as Record<string, unknown>;
  if (t["symbol"] !== symbol) throw new Error("Par Binance divergente");
  const bid = positive(t["bidPrice"]);
  const ask = positive(t["askPrice"]);
  const lastPrice = positive(t["lastPrice"]);
  const high = positive(t["highPrice"]);
  const low = positive(t["lowPrice"]);
  const changePct = Number(t["priceChangePercent"]);
  const quoteVolume = nonnegative(t["quoteVolume"]);
  if (low > high || bid > ask || !Number.isFinite(changePct)) throw new Error("Ticker Binance inconsistente");
  return {
    symbol, lastPrice, changePct, changeBasis: "rolling_24h",
    high, low, quoteVolume, quoteVolumeEstimated: false,
    bid, ask, spreadPct: ((ask - bid) / ((bid + ask) / 2)) * 100,
    fetchedAt: Date.now(), source: "binance_public",
  };
}

/** Returns only verified pairs. Missing pairs must be reported by UI, never fabricated. */
export async function fetchPublicTickers(symbols: readonly string[]): Promise<PublicTicker[]> {
  const requested = [...new Set(symbols)];
  if (!requested.length || requested.length > 50 || requested.some((symbol) => !SYMBOL.test(symbol))) {
    throw new Error("Lista de pares inválida");
  }
  try {
    const raw = await json(`${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(requested))}`);
    if (!Array.isArray(raw) || raw.length !== requested.length) throw new Error("Ticker incompleto");
    const bySymbol = new Map<string, unknown>();
    for (const item of raw) {
      if (!item || typeof item !== "object") throw new Error("Ticker inválido");
      const symbol = (item as Record<string, unknown>)["symbol"];
      if (typeof symbol !== "string" || bySymbol.has(symbol)) throw new Error("Ticker duplicado");
      bySymbol.set(symbol, item);
    }
    return requested.map((symbol) => tickerFromBinance(bySymbol.get(symbol), symbol));
  } catch {
    // Use only exact supported USDT markets. Other assets stay unavailable.
    const supported = requested.filter((symbol) => Boolean(KRAKEN_PAIRS[symbol]));
    const resolved = await Promise.allSettled(supported.map(async (symbol) => {
      const raw = await json(`${KRAKEN}/Ticker?pair=${KRAKEN_PAIRS[symbol]!.request}`);
      return tickerFromKraken(raw, symbol);
    }));
    const found = resolved.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
    if (!found.length) throw new Error("Cotações públicas indisponíveis para os ativos monitorados");
    return found;
  }
}

function validateCandles(candles: PublicCandle[], interval: MarketInterval, now: number): PublicCandle[] {
  const period = PERIOD_MINUTES[interval] * 60_000;
  if (candles.length < 30) throw new Error("Histórico insuficiente");
  let previous = -Infinity;
  for (const c of candles) {
    if (!Number.isSafeInteger(c.openTime) || c.openTime <= previous ||
        c.openTime > now + period || c.closeTime !== c.openTime + period - 1 ||
        ![c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v > 0) ||
        !Number.isFinite(c.volume) || c.volume < 0 ||
        c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) {
      throw new Error("Candles inválidos ou desordenados");
    }
    previous = c.openTime;
  }
  if (now - candles[candles.length - 1]!.openTime > period * 2) {
    throw new Error("Candles desatualizados");
  }
  return candles;
}

function binanceCandles(value: unknown, interval: MarketInterval): PublicCandle[] {
  if (!Array.isArray(value)) throw new Error("Candles Binance inválidos");
  return value.map((row: unknown) => {
    if (!Array.isArray(row) || row.length < 7) throw new Error("Candle Binance incompleto");
    return {
      openTime: Number(row[0]), open: positive(row[1]), high: positive(row[2]),
      low: positive(row[3]), close: positive(row[4]), volume: nonnegative(row[5]),
      // Derive a common exchange-independent interval end for closed-candle checks.
      closeTime: Number(row[0]) + PERIOD_MINUTES[interval] * 60_000 - 1,
      source: "binance_public" as const,
    };
  });
}

function krakenCandles(value: unknown, symbol: string, interval: MarketInterval): PublicCandle[] {
  const raw = krakenResponse(value, symbol);
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Candles Kraken inválidos");
  const period = PERIOD_MINUTES[interval] * 60_000;
  return raw.map((row: unknown) => {
    if (!Array.isArray(row) || row.length < 7) throw new Error("Candle Kraken incompleto");
    const openTime = Number(row[0]) * 1000;
    return {
      openTime, open: positive(row[1]), high: positive(row[2]),
      low: positive(row[3]), close: positive(row[4]), volume: nonnegative(row[6]),
      closeTime: openTime + period - 1, source: "kraken_public" as const,
    };
  });
}

export async function fetchPublicCandles(
  symbol: string, interval: MarketInterval, limit: number,
): Promise<PublicCandle[]> {
  if (!SYMBOL.test(symbol) || !(interval in PERIOD_MINUTES) ||
      !Number.isInteger(limit) || limit < 30 || limit > 1000) throw new Error("Consulta inválida");
  try {
    const raw = await json(`${BINANCE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    return validateCandles(binanceCandles(raw, interval), interval, Date.now()).slice(-limit);
  } catch {
    const pair = KRAKEN_PAIRS[symbol];
    if (!pair) throw new Error("Histórico alternativo indisponível para este par");
    const raw = await json(`${KRAKEN}/OHLC?pair=${pair.request}&interval=${PERIOD_MINUTES[interval]}`);
    return validateCandles(krakenCandles(raw, symbol, interval), interval, Date.now()).slice(-limit);
  }
}
