import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Ticker } from "@/features/market/services/market.functions";
import { formatCompact, formatPct, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AssetTable({ tickers }: { tickers: readonly Ticker[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Último</TableHead>
            <TableHead className="text-right">Variação</TableHead>
            <TableHead className="text-right">Máx</TableHead>
            <TableHead className="text-right">Mín</TableHead>
            <TableHead className="text-right">Volume (USDT)</TableHead>
            <TableHead className="text-right">Spread</TableHead>
            <TableHead>Fonte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickers.map((t) => (
            <TableRow key={t.symbol}>
              <TableCell className="font-semibold">{t.symbol}</TableCell>
              <TableCell className="tabular text-right">{formatPrice(t.lastPrice)}</TableCell>
              <TableCell className={cn("tabular text-right", t.changePct >= 0 ? "text-gain" : "text-loss")}>{formatPct(t.changePct)} <span className="text-[10px] text-muted-foreground">{t.changeBasis === "today_open" ? "hoje" : "24h"}</span></TableCell>
              <TableCell className="tabular text-right">{formatPrice(t.high)}</TableCell>
              <TableCell className="tabular text-right">{formatPrice(t.low)}</TableCell>
              <TableCell className="tabular text-right">{t.quoteVolumeEstimated ? "≈ " : ""}{formatCompact(t.quoteVolume)}</TableCell>
              <TableCell className="tabular text-right">{t.spreadPct.toFixed(4)}%</TableCell>
              <TableCell className="text-xs">{t.source === "kraken_public" ? "Kraken" : "Binance"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
