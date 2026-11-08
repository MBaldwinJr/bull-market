import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/trading/panel";
import { PositionTable } from "@/components/trading/position-table";
import { QueryView } from "@/components/trading/state-views";
import { usePositions } from "@/features/account/hooks/use-account";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => pageHead("Portfólio", "Todas as posições simuladas, abertas e encerradas."),
  component: PortfolioPage,
});

function PortfolioPage() {
  const positions = usePositions();
  return (
    <>
      <PageHeader title="Portfólio" description="Perda realizada, taxas e resultado líquido por posição." />
      <Panel>
        <QueryView query={positions}>{(list) => <PositionTable positions={list} emptyTitle="Portfólio vazio" />}</QueryView>
      </Panel>
    </>
  );
}
