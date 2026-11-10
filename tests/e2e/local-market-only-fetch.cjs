"use strict";

// This preload is used exclusively by a disposable GitHub Actions job.
// It cannot be enabled in a deployed Bull Market runtime.
if (process.env.BULL_MARKET_LOCAL_HTTP_E2E !== "1") {
  throw new Error("Local HTTP mock requires explicit isolated CI activation");
}
if (process.env.SUPABASE_URL !== "http://127.0.0.1:54321" ||
    process.env.VITE_SUPABASE_URL !== "http://127.0.0.1:54321" ||
    process.env.PAPER_TRADING_ROUTE_ENABLED === "true" ||
    process.env.PAPER_TRADING_EXECUTION_ENABLED === "true") {
  throw new Error("Refusing non-local Supabase or enabled order execution");
}

const realFetch = globalThis.fetch;
if (typeof realFetch !== "function") throw new Error("Node fetch missing");
const market = "data-api.binance.vision";
const prices = new Map([
  ["BTCUSDT", 50000],
  ["ETHUSDT", 3000],
  ["BNBUSDT", 600],
  ["SOLUSDT", 200],
  ["USDCUSDT", 1],
  ["USDTBRL", 5.5],
]);
const payload = (value) => Promise.resolve(new Response(JSON.stringify(value), {
  status: 200, headers: { "content-type": "application/json" },
}));

globalThis.fetch = (input, init) => {
  const text = typeof input === "string" ? input
    : input instanceof URL ? input.toString()
    : input && typeof input.url === "string" ? input.url : "";
  const url = new URL(text);
  if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) {
    return realFetch(input, init);
  }
  if (url.protocol === "https:" && url.hostname === market
      && url.pathname === "/api/v3/ticker/price") {
    const symbol = url.searchParams.get("symbol");
    if (prices.has(symbol)) return payload({ symbol, price: String(prices.get(symbol)) });
  }
  if (url.protocol === "https:" && url.hostname === market
      && url.pathname === "/api/v3/ticker/24hr") {
    const symbolsJson = url.searchParams.get("symbols");
    try {
      const symbols = JSON.parse(symbolsJson);
      if (!Array.isArray(symbols) || symbols.some(s => !prices.has(s))) {
        throw new Error("Unexpected ticker symbol");
      }
      return payload(symbols.map(symbol => {
        const price = prices.get(symbol);
        return {
          symbol, lastPrice: String(price), highPrice: String(price * 1.02),
          lowPrice: String(price * 0.98), bidPrice: String(price * 0.9999),
          askPrice: String(price * 1.0001), quoteVolume: "10000000",
          priceChangePercent: "0.5",
        };
      }));
    } catch {
      throw new Error("Invalid ticker request in isolated CI");
    }
  }
  throw new Error("External HTTP blocked by isolated CI: " + url.hostname);
};
