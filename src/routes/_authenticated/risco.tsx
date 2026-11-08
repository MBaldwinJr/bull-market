import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/trading/panel";
import { RiskPanel } from "@/components/trading/risk-panel";
import { RiskEventList } from "@/components/trading/risk-event-list";
import { QueryView } from "@/components/trading/state-views";
import { useRiskEvents, useRiskLimits } from "@/features/account/hooks/use-account";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/risco")({
  head: () => pageHead("Gestão de risco", "Limites do Risk Engine e eventos de bloqueio."),
  component: RiskPage,
});

function RiskPage() {
  const limits = useRiskLimits();
  const events = useRiskEvents();
  return (
    <>
      <PageHeader title="Gestão de risco" description="Limites aplicados antes de qualquer ordem simulada." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Limites">
          <QueryView query={limits}>{(l) => <RiskPanel limits={l} />}</QueryView>
        </Panel>
        <Panel title="Eventos de risco">
          <QueryView query={events}>{(list) => <RiskEventList events={list} />}</QueryView>
        </Panel>
      </div>
    </>
  );
}
