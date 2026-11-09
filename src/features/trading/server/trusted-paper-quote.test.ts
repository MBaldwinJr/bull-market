import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrustedPaperQuote } from "./trusted-paper-quote";

afterEach(() => vi.unstubAllGlobals());
describe("trusted paper quote", () => {
  it("reads a validated spot price from the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ symbol: "BTCUSDT", price: "123.45" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const quote = await fetchTrustedPaperQuote("BTCUSDT");
    expect(quote).toMatchObject({ symbol: "BTCUSDT", price: 123.45 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
  });
  it("rejects invalid symbols without network access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchTrustedPaperQuote("BTC/USDT")).rejects.toThrow("Símbolo inválido");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { symbol: "ETHUSDT", price: "10" },
    { symbol: "BTCUSDT", price: "NaN" },
    { symbol: "BTCUSDT", price: "0" },
  ])("rejects inconsistent quote %j", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    await expect(fetchTrustedPaperQuote("BTCUSDT")).rejects.toThrow();
  });
  it("rejects unavailable exchange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchTrustedPaperQuote("BTCUSDT")).rejects.toThrow("503");
  });
});
