/** Fetches the execution price from Binance's public spot API on the server.
 * Never accept the price or freshness timestamp from a browser request.
 */
const BINANCE_PUBLIC = "https://data-api.binance.vision/api/v3";
const SYMBOL_PATTERN = /^[A-Z0-9]{2,20}$/;

export interface TrustedPaperQuote {
  symbol: string;
  price: number;
  fetchedAt: string;
}

export async function fetchTrustedPaperQuote(symbol: string): Promise<TrustedPaperQuote> {
  if (!SYMBOL_PATTERN.test(symbol)) throw new Error("Símbolo inválido");
  const response = await fetch(`${BINANCE_PUBLIC}/ticker/price?symbol=${encodeURIComponent(symbol)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Binance respondeu ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("Cotação inválida");
  const data = payload as Record<string, unknown>;
  if (data.symbol !== symbol || typeof data.price !== "string") throw new Error("Cotação inconsistente");
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Preço inválido");
  return { symbol, price, fetchedAt: new Date().toISOString() };
}
