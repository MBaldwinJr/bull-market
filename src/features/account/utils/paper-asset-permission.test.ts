import { describe, expect, it } from "vitest";
import { canSetPaperAssetPermission } from "./paper-asset-permission";

const btc = { symbol: "BTCUSDT", quote_asset: "USDT", status: "active", deleted_at: null };

describe("Paper Trading asset permission safety", () => {
  it("permits explicit grant only for active supported USDT pairs", () => {
    expect(canSetPaperAssetPermission(btc, true)).toBe(true);
    expect(canSetPaperAssetPermission({ ...btc, symbol: "ETHUSDT" }, true)).toBe(true);
  });

  it("rejects grant on unsupported, inactive, removed or quote-mismatched assets", () => {
    expect(canSetPaperAssetPermission({ ...btc, symbol: "SOLUSDT" }, true)).toBe(false);
    expect(canSetPaperAssetPermission({ ...btc, symbol: "BNBUSDT" }, true)).toBe(false);
    expect(canSetPaperAssetPermission({ ...btc, quote_asset: "USD" }, true)).toBe(false);
    expect(canSetPaperAssetPermission({ ...btc, status: "inactive" }, true)).toBe(false);
    expect(canSetPaperAssetPermission({ ...btc, deleted_at: "2026-11-08T01:00:00Z" }, true)).toBe(false);
  });

  it("never blocks explicit permission revocation", () => {
    expect(canSetPaperAssetPermission(btc, false)).toBe(true);
    expect(canSetPaperAssetPermission({ ...btc, symbol: "SOLUSDT" }, false)).toBe(true);
    expect(canSetPaperAssetPermission({ ...btc, deleted_at: "2026-11-08T01:00:00Z" }, false)).toBe(true);
  });
});
