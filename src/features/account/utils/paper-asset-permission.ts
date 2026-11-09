/**
 * Read-only eligibility rule for the manual permission control.
 * This does not prove the feed is live, authorize an order, or start a bot.
 * The authenticated server and database must independently verify each order.
 */
export interface PaperAssetPermissionTarget {
  readonly symbol: string;
  readonly quote_asset: string;
  readonly status: string;
  readonly deleted_at: string | null;
}

const SUPPORTED_PUBLIC_FALLBACK = new Set(["BTCUSDT", "ETHUSDT"]);

/**
 * Revocation is always allowed. Grant is limited to the two currently verified
 * fallback markets, preventing false assurances for unpriced assets.
 */
export function canSetPaperAssetPermission(asset: PaperAssetPermissionTarget, enabled: boolean): boolean {
  if (!enabled) return true;
  return asset.status === "active" &&
    asset.deleted_at === null &&
    asset.quote_asset === "USDT" &&
    SUPPORTED_PUBLIC_FALLBACK.has(asset.symbol);
}
