import { fetchPublicSpotQuote } from "@/features/market/server/public-spot-quote.server";

/**
 * Trusted server-side spot quote for paper execution. Binance public market
 * is preferred, Kraken public BTC/USDT or ETH/USDT is the fallback.
 * No user-supplied price, credentials, exchange orders, or live trading.
 */
export interface TrustedPaperQuote {
  symbol: string;
  price: number;
  fetchedAt: string;
}

export async function fetchTrustedPaperQuote(symbol: string): Promise<TrustedPaperQuote> {
  const quote = await fetchPublicSpotQuote(symbol);
  const ageMs = Date.now() - Date.parse(quote.fetchedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 30_000) {
    throw new Error("Cotação pública indisponível ou desatualizada");
  }
  return { symbol: quote.symbol, price: quote.price, fetchedAt: quote.fetchedAt };
}
