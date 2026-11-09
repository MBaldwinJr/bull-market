import { afterEach, describe, expect, it, vi } from "vitest";
import { closedCandles, computeIndicators } from "../utils/indicators";
import { fetchPublicCandles, fetchPublicTickers } from "./public-market-data.server";

const respond = (value: unknown) => ({ ok: true, json: async () => value });
const denied = { ok: false, status: 403 };
const BTC = {
  a: ["65100", "1"], b: ["64990", "1"], c: ["65000", "0.1"],
  h: ["65500", "65500"], l: ["64500", "64500"],
  v: ["200", "300"], p: ["65000", "64950"], o: "64800",
};
function ohlcRows(hoursAgo = 0) {
  const currentHour = Math.floor(Date.now() / 3600000) * 3600000 - hoursAgo * 3600000;
  return Array.from({ length: 300 }, (_, i) => [
    (currentHour - (299 - i) * 3600000) / 1000, "65000", "65100", "64900",
    String(65000 + i / 10), "65000", "2", 5,
  ]);
}
afterEach(() => vi.unstubAllGlobals());

describe("market data fallback after Binance HTTP 403", () => {
  it("returns valid Kraken ticker and explicitly omits unsupported pairs", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(denied)
      .mockResolvedValueOnce(respond({ error: [], result: { XBTUSDT: BTC } }))
      .mockResolvedValueOnce(respond({ error: [], result: { ETHUSDT: { ...BTC, o: "64000" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const tickers = await fetchPublicTickers(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
    expect(tickers.map((t) => t.symbol)).toEqual(["BTCUSDT", "ETHUSDT"]);
    expect(tickers[0]).toMatchObject({
      lastPrice: 65000, source: "kraken_public", changeBasis: "today_open",
      quoteVolumeEstimated: true,
    });
    expect(tickers[0]?.quoteVolume).toBe(300 * 64950);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not replace a USDT pair with the USD market", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(denied)
      .mockResolvedValueOnce(respond({ error: [], result: { XXBTZUSD: BTC } })));
    await expect(fetchPublicTickers(["BTCUSDT"])).rejects.toThrow("indisponíveis");
  });

  it("fails closed for Binance outage without supported Kraken markets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(denied));
    await expect(fetchPublicTickers(["SOLUSDT"])).rejects.toThrow("indisponíveis");
  });

  it("maps Binance 24h ticker with its actual 24h change basis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond([{
      symbol: "BTCUSDT", lastPrice: "65000", priceChangePercent: "1.2",
      highPrice: "65500", lowPrice: "64000", quoteVolume: "100000",
      bidPrice: "64999", askPrice: "65001",
    }])));
    await expect(fetchPublicTickers(["BTCUSDT"])).resolves.toMatchObject([
      { source: "binance_public", changeBasis: "rolling_24h", quoteVolumeEstimated: false },
    ]);
  });

  it("maps Kraken 1h OHLC with second-to-millisecond timestamps and usable closed candles", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(denied)
      .mockResolvedValueOnce(respond({ error: [], result: { XBTUSDT: ohlcRows(), last: "ignored" } })));
    const candles = await fetchPublicCandles("BTCUSDT", "1h", 300);
    expect(candles).toHaveLength(300);
    expect(candles[0]?.source).toBe("kraken_public");
    expect(candles[0]?.closeTime).toBe(candles[0]!.openTime + 3600000 - 1);
    expect(candles[candles.length - 1]?.volume).toBe(2);
    const finished = closedCandles(candles, Date.now());
    expect(finished.length).toBeGreaterThanOrEqual(299);
    expect(computeIndicators(finished)?.ema200).not.toBeNull();
  });

  it("rejects a stale Kraken candle series rather than returning fabricated signals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(denied)
      .mockResolvedValueOnce(respond({ error: [], result: { XBTUSDT: ohlcRows(5) } })));
    await expect(fetchPublicCandles("BTCUSDT", "1h", 300)).rejects.toThrow("desatualizados");
  });

  it("rejects invalid prices in otherwise correctly shaped OHLC responses", async () => {
    const rows = ohlcRows();
    rows[20]![2] = "0";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(denied)
      .mockResolvedValueOnce(respond({ error: [], result: { XBTUSDT: rows } })));
    await expect(fetchPublicCandles("BTCUSDT", "1h", 300)).rejects.toThrow();
  });

  it("does not use Kraken data for unsupported pairs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(denied);
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPublicCandles("BNBUSDT", "1h", 300)).rejects.toThrow("indisponível");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
