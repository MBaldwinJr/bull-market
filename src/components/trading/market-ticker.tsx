import { useAssets } from "@/features/account/hooks/use-account";
import { useTickers } from "@/features/market/hooks/use-market";
import { formatPct, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Live strip of watched assets from Binance public market data. */
export function MarketTicker() {
  const assets = useAssets();
  const symbols = (assets.data ?? []).map((a) => a.symbol);
  const tickers = useTickers(symbols);

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto rounded-md border bg-secondary p-2" aria-live="polite">
      {symbols.length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhum ativo monitorado. Adicione ativos em Configurações.</span>
      ) : tickers.error ? (
        <span className="text-xs text-loss">Cotações indisponíveis — verifique a conexão com a Binance. Novas entradas devem permanecer bloqueadas.</span>
      ) : !tickers.data ? (
        <span className="text-xs text-muted-foreground">Carregando cotações…</span>
      ) : (
        tickers.data.map((t) => (
          <div key={t.symbol} className="flex shrink-0 items-baseline gap-2 border-r px-3 last:border-r-0">
            <span className="text-xs font-semibold">{t.symbol}</span>
            <span className="tabular text-sm">{formatPrice(t.lastPrice)}</span>
            <span className={cn("tabular text-xs", t.changePct >= 0 ? "text-gain" : "text-loss")}>{formatPct(t.changePct)}</span>
          </div>
        ))
      )}
    </div>
  );
}
