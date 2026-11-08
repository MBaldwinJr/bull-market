import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaperPosition } from "@/features/account/services/account-service";
import { formatPrice, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "./state-views";

export function PositionTable({ positions, emptyTitle }: { positions: readonly PaperPosition[]; emptyTitle: string }) {
  if (!positions.length) return <EmptyState title={emptyTitle} />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Entrada</TableHead>
            <TableHead className="text-right">Stop</TableHead>
            <TableHead className="text-right">Alvo</TableHead>
            <TableHead className="text-right">P&L realizado</TableHead>
            <TableHead>Estratégia</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => {
            const pnl = p.realized_pnl === null ? null : toNumber(p.realized_pnl);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.symbol}</TableCell>
                <TableCell className="tabular text-right">{toNumber(p.quantity)}</TableCell>
                <TableCell className="tabular text-right">{formatPrice(toNumber(p.entry_price))}</TableCell>
                <TableCell className="tabular text-right text-loss">{formatPrice(toNumber(p.stop_loss))}</TableCell>
                <TableCell className="tabular text-right">{p.take_profit ? formatPrice(toNumber(p.take_profit)) : "—"}</TableCell>
                <TableCell className={cn("tabular text-right", pnl === null ? "" : pnl >= 0 ? "text-gain" : "text-loss")}>
                  {pnl === null ? "—" : formatPrice(pnl)}
                </TableCell>
                <TableCell className="text-xs">{p.strategy_key ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.status === "open" ? "Aberta" : "Encerrada"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
