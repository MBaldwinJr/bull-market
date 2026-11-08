import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/trading/panel";
import { SystemHealthPanel } from "@/components/trading/system-health-panel";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/conexoes")({
  head: () => pageHead("Conexões", "Estado real das conexões com corretora, backend e fontes de dados."),
  component: () => (
    <>
      <PageHeader title="Conexões" description="Nenhuma conexão é exibida como ativa sem verificação real." />
      <Panel>
        <SystemHealthPanel />
      </Panel>
    </>
  ),
});
