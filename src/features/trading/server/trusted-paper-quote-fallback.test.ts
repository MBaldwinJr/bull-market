import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrustedPaperQuote } from "./trusted-paper-quote";

afterEach(() => vi.unstubAllGlobals());

describe("trusted paper quote with public fallback", () => {
  it("returns a validated Kraken BTCUSDT price after Binance HTTP 403", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        error: [], result: { XBTUSDT: { c: ["65000", "1"] } },
      }) });
    vi.stubGlobal("fetch", fetchMock);
    const quote = await fetchTrustedPaperQuote("BTCUSDT");
    expect(quote).toMatchObject({ symbol: "BTCUSDT", price: 65000 });
    expect(Date.now() - Date.parse(quote.fetchedAt)).toBeLessThan(30000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects if both providers fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchTrustedPaperQuote("BTCUSDT")).rejects.toThrow();
  });

  it("never silently substitutes a different quote currency", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        error: [], result: { XBTUSD: { c: ["65000", "1"] } },
      }) }));
    await expect(fetchTrustedPaperQuote("BTCUSDT")).rejects.toThrow();
  });
});
