import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkExchangeSymbol, getCandles, getDollarQuotes, getExchangeHealth, getTickers } from "../services/market.functions";

export function useTickers(symbols: readonly string[]) {
  const fn = useServerFn(getTickers);
  return useQuery({
    queryKey: ["tickers", [...symbols].sort()],
    queryFn: () => fn({ data: { symbols: [...symbols] } }),
    enabled: symbols.length > 0,
    refetchInterval: 10_000,
    retry: 2,
  });
}

export function useCandles(symbol: string, interval: "15m" | "1h" | "4h" | "1d" = "1h") {
  const fn = useServerFn(getCandles);
  return useQuery({
    queryKey: ["candles", symbol, interval],
    queryFn: () => fn({ data: { symbol, interval, limit: 300 } }),
    refetchInterval: 60_000,
    retry: 2,
  });
}

export const exchangeHealthQuery = queryOptions({
  queryKey: ["exchange-health"],
  queryFn: () => getExchangeHealth(),
  refetchInterval: 30_000,
});

export function useExchangeHealth() {
  return useQuery(exchangeHealthQuery);
}

export function useDollarQuotes() {
  const fn = useServerFn(getDollarQuotes);
  return useQuery({ queryKey: ["dollar-quotes"], queryFn: () => fn(), refetchInterval: 60_000 });
}

export function useCheckSymbol() {
  return useServerFn(checkExchangeSymbol);
}
