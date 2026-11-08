import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, SimulationBadge } from "@/components/trading/panel";
import { PositionTable } from "@/components/trading/position-table";
import { QueryView } from "@/components/trading/state-views";
import { TradingMetricCard } from "@/components/trading/trading-metric-card";
import { usePaperAccount, usePositions } from "@/features/account/hooks/use-account";
import { formatMoney, toNumber } from "@/lib/format";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/paper")({
  head: () => pageHead("Paper Trading", "Conta virtual, posições simuladas e saldo."),
  component: PaperPage,
});

function PaperPage() {
  const account = usePaperAccount();
  const positions = usePositions();
  return (
    <>
      <PageHeader title="Paper Trading" description="Simulador com saldo virtual. Não confundir com Binance Testnet." actions={<SimulationBadge />} />
      <QueryView query={account}>
        {(a) => (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <TradingMetricCard label="Saldo inicial" value={formatMoney(toNumber(a.initial_balance), a.quote_currency)} />
            <TradingMetricCard label="Saldo disponível" value={formatMoney(toNumber(a.cash_balance), a.quote_currency)} />
            <TradingMetricCard label="Status" value={a.status} hint={<Link to="/configuracoes" className="text-primary">Alterar saldo virtual</Link>} />
          </div>
        )}
      </QueryView>
      <Panel title="Posições abertas">
        <QueryView query={positions}>
          {(list) => <PositionTable positions={list.filter((p) => p.status === "open")} emptyTitle="Nenhuma posição simulada aberta" />}
        </QueryView>
      </Panel>
    </>
  );
}
