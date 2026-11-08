import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PaperOrder } from "@/features/account/services/account-service";
import { formatPrice, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "./state-views";

export function TradeHistory({ orders }: { orders: readonly PaperOrder[] }) {
  if (!orders.length)
    return <EmptyState title="Nenhuma ordem simulada" description="As ordens aparecem aqui quando o motor de Paper Trading executar." />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead>Lado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Solicitado</TableHead>
            <TableHead className="text-right">Executado</TableHead>
            <TableHead className="text-right">Taxa</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="tabular text-xs">{new Date(o.created_at).toLocaleString("pt-BR")}</TableCell>
              <TableCell className="font-medium">{o.symbol}</TableCell>
              <TableCell className={cn("uppercase", o.side === "buy" ? "text-gain" : "text-loss")}>{o.side}</TableCell>
              <TableCell className="text-xs">{o.order_type}</TableCell>
              <TableCell className="tabular text-right">{toNumber(o.quantity)}</TableCell>
              <TableCell className="tabular text-right">{o.requested_price ? formatPrice(toNumber(o.requested_price)) : "—"}</TableCell>
              <TableCell className="tabular text-right">{o.executed_price ? formatPrice(toNumber(o.executed_price)) : "—"}</TableCell>
              <TableCell className="tabular text-right">{formatPrice(toNumber(o.fee))}</TableCell>
              <TableCell className="text-xs">{o.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
