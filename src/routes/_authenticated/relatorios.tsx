import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/trading/panel";
import { ModulePending } from "@/components/trading/module-pending";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => pageHead("Relatórios", "Relatórios de desempenho das estratégias e da conta simulada."),
  component: () => (
    <>
      <PageHeader title="Relatórios" />
      <ModulePending
        phase="P2"
        dependsOn="GET /api/v1/reports/performance"
        features={["Desempenho por período", "Comparação entre estratégias", "Custos: taxas e slippage", "Exportação"]}
      />
    </>
  ),
});
