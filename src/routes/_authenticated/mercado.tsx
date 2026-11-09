import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/trading/panel";
import { AssetTable } from "@/components/trading/asset-table";
import { PriceChart } from "@/components/trading/charts";
import { QueryView } from "@/components/trading/state-views";
import { DollarPanel } from "@/features/market/components/dollar-panel";
import { useAssets } from "@/features/account/hooks/use-account";
import { useCandles, useTickers } from "@/features/market/hooks/use-market";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/mercado")({
  head: () => pageHead("Mercado", "Cotações públicas verificadas, com fallback parcial da Kraken."),
  component: MarketPage,
});

function MarketPage() {
  const assets = useAssets();
  const symbols = useMemo(() => (assets.data ?? []).map((a) => a.symbol), [assets.data]);
  const tickers = useTickers(symbols);
  const missing = symbols.filter((symbol) => !tickers.data?.some((ticker) => ticker.symbol === symbol));
  const [minVolume, setMinVolume] = useState(0);
  const [maxSpread, setMaxSpread] = useState(1);
  const [selected, setSelected] = useState("BTCUSDT");
  const candles = useCandles(selected, "1h");

  const filtered = useMemo(
    () => (tickers.data ?? []).filter((t) => t.quoteVolume >= minVolume * 1e6 && t.spreadPct <= maxSpread),
    [tickers.data, minVolume, maxSpread],
  );
  const chartData = useMemo(
    () => (candles.data ?? []).map((c) => ({ t: new Date(c.openTime).toLocaleString("pt-BR", { day: "2-digit", hour: "2-digit" }), close: c.close })),
    [candles.data],
  );

  return (
    <>
      <PageHeader title="Mercado" description="Dados públicos da Binance ou Kraken (fallback parcial). Cotações verificadas a cada 10 segundos." />
      <Panel title="Filtros" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="minvol">Volume mínimo 24h (milhões USDT)</Label>
            <Input id="minvol" type="number" min={0} value={minVolume} onChange={(e) => setMinVolume(Math.max(0, Number(e.target.value)))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="spread">Spread máximo (%)</Label>
            <Input id="spread" type="number" min={0} step={0.01} value={maxSpread} onChange={(e) => setMaxSpread(Math.max(0, Number(e.target.value)))} />
          </div>
        </div>
      </Panel>
      <Panel title="Ativos monitorados" className="mb-4">
        {tickers.data && missing.length > 0 && (
          <p role="status" className="mb-3 text-xs text-warning">Sem fonte pública validada neste ambiente: {missing.join(", ")}. Esses ativos não são exibidos como negociáveis.</p>
        )}
        <QueryView query={tickers} isEmpty={() => filtered.length === 0}>
          {() => <AssetTable tickers={filtered} />}
        </QueryView>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Preço · 1h (candles encerrados e em formação)"
          className="lg:col-span-2"
          actions={
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-8 w-36" aria-label="Ativo do gráfico">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          {candles.data && <p className="mb-2 text-xs text-muted-foreground">Fonte: {candles.data[0]?.source === "kraken_public" ? "Kraken" : "Binance"} · candles fechados e candle atual em formação.</p>}
          <QueryView query={candles}>{() => <PriceChart data={chartData} />}</QueryView>
        </Panel>
        <DollarPanel />
      </div>
    </>
  );
}
