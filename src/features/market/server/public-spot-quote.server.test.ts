import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicSpotQuote } from "./public-spot-quote.server";

afterEach(() => vi.unstubAllGlobals());

describe("public quote fallback", () => {
  it("uses Binance when it returns a valid price", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ symbol: "BTCUSDT", price: "100" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPublicSpotQuote("BTCUSDT")).resolves.toMatchObject({ price: 100, source: "binance_public" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses Kraken BTC/USDT after Binance HTTP 403", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        error: [], result: { XBTUSDT: { c: ["99.5", "1"] } },
      }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPublicSpotQuote("BTCUSDT")).resolves.toMatchObject({ price: 99.5, source: "kraken_public" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed for unsupported pairs and invalid fallback responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchPublicSpotQuote("DOGEUSDT")).rejects.toThrow("indisponível");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        error: [], result: { XBTUSD: { c: ["100"] } },
      }) }));
    await expect(fetchPublicSpotQuote("BTCUSDT")).rejects.toThrow("inesperado");
  });
});
