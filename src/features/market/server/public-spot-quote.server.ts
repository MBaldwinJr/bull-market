/** Server-side, public-only spot quote with a validated fallback.
 * No API keys, orders, or trading operations. All prices are denominated in USDT.
 */
const SYMBOL = /^[A-Z0-9]{2,20}$/;
const TIMEOUT_MS = 7000;
export interface PublicSpotQuote {
  readonly symbol: string;
  readonly price: number;
  readonly source: "binance_public" | "kraken_public";
  readonly fetchedAt: string;
}

async function fetchPrice(url: string, parse: (body: unknown) => number): Promise<number> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const price = parse(await response.json());
  if (!Number.isFinite(price) || price <= 0) throw new Error("Preço público inválido");
  return price;
}

export async function fetchPublicSpotQuote(symbol: string): Promise<PublicSpotQuote> {
  if (!SYMBOL.test(symbol)) throw new Error("Símbolo inválido");
  try {
    const price = await fetchPrice(
      `https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
      (body) => {
        if (!body || typeof body !== "object") throw new Error("Resposta inválida");
        const quote = body as Record<string, unknown>;
        if (quote["symbol"] !== symbol || typeof quote["price"] !== "string") throw new Error("Par inválido");
        return Number(quote["price"]);
      },
    );
    return { symbol, price, source: "binance_public", fetchedAt: new Date().toISOString() };
  } catch {
    // Kraken pair mapping is deliberately narrow. Never silently substitute
    // BTC/USD for BTC/USDT or use a mismatched market.
    if (symbol !== "BTCUSDT" && symbol !== "ETHUSDT") {
      throw new Error("Cotação pública indisponível para este par");
    }
    const base = symbol === "BTCUSDT" ? "XBT" : "ETH";
    const price = await fetchPrice(
      `https://api.kraken.com/0/public/Ticker?pair=${base}USDT`,
      (body) => {
        if (!body || typeof body !== "object") throw new Error("Resposta Kraken inválida");
        const data = body as { error?: unknown; result?: unknown };
        if (!Array.isArray(data.error) || data.error.length !== 0 || !data.result ||
            typeof data.result !== "object") throw new Error("Erro Kraken");
        const entries = Object.entries(data.result as Record<string, unknown>);
        if (entries.length !== 1) throw new Error("Par Kraken ambíguo");
        const [pair, ticker] = entries[0];
        if (!pair.toUpperCase().includes("USDT") || !ticker || typeof ticker !== "object") {
          throw new Error("Par Kraken inesperado");
        }
        const last = (ticker as { c?: unknown }).c;
        if (!Array.isArray(last) || typeof last[0] !== "string") throw new Error("Preço Kraken inválido");
        return Number(last[0]);
      },
    );
    return { symbol, price, source: "kraken_public", fetchedAt: new Date().toISOString() };
  }
}
