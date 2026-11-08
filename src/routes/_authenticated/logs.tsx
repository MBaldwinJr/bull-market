import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/trading/panel";
import { RiskEventList } from "@/components/trading/risk-event-list";
import { EmptyState, QueryView } from "@/components/trading/state-views";
import { useAuditLogs, useRiskEvents } from "@/features/account/hooks/use-account";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => pageHead("Logs do sistema", "Auditoria de ações e eventos do Risk Engine."),
  component: LogsPage,
});

function LogsPage() {
  const audit = useAuditLogs();
  const events = useRiskEvents();
  return (
    <>
      <PageHeader title="Logs do sistema" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Auditoria">
          <QueryView query={audit} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Nenhuma ação registrada" />}>
            {(list) => (
              <ul className="tabular divide-y text-xs">
                {list.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 py-2">
                    <span>
                      <b className="text-primary">{l.action}</b> <span className="text-muted-foreground">{l.entity}</span>
                    </span>
                    <time className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</time>
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
        </Panel>
        <Panel title="Eventos de risco">
          <QueryView query={events}>{(list) => <RiskEventList events={list} />}</QueryView>
        </Panel>
      </div>
    </>
  );
}
