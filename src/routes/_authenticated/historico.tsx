import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/trading/panel";
import { QueryView } from "@/components/trading/state-views";
import { TradeHistory } from "@/components/trading/trade-history";
import { useOrders } from "@/features/account/hooks/use-account";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => pageHead("Histórico de operações", "Todas as ordens simuladas com preço solicitado e executado."),
  component: HistoryPage,
});

function HistoryPage() {
  const orders = useOrders();
  return (
    <>
      <PageHeader title="Histórico de operações" />
      <Panel>
        <QueryView query={orders}>{(list) => <TradeHistory orders={list} />}</QueryView>
      </Panel>
    </>
  );
}
