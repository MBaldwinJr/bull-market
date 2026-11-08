import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/trading/panel";
import { ModulePending } from "@/components/trading/module-pending";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/ia")({
  head: () => pageHead("Inteligência Artificial", "Explicações de contexto e avaliação de sinais pela IA."),
  component: () => (
    <>
      <PageHeader title="Inteligência Artificial" description="A IA explica e avalia. Ela nunca envia ordens nem altera limites." />
      <ModulePending
        phase="P1"
        dependsOn="AI Engine com respostas estruturadas e validadas"
        features={[
          "Explicar tendências e divergências",
          "Resumir notícias e eventos",
          "Detectar condições anormais",
          "Comparar estratégias",
          "Justificar decisões do motor",
          "Sem permissão de execução",
        ]}
      />
    </>
  ),
});
