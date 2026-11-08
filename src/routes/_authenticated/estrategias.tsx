import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/trading/panel";
import { QueryView } from "@/components/trading/state-views";
import { StrategyCard } from "@/components/trading/strategy-card";
import { useStrategies } from "@/features/account/hooks/use-account";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/estrategias")({
  head: () => pageHead("Estratégias", "Ative estratégias técnicas e ajuste seus pesos na pontuação."),
  component: StrategiesPage,
});

function StrategiesPage() {
  const strategies = useStrategies();
  const total = (strategies.data ?? []).filter((s) => s.enabled).reduce((a, s) => a + s.weight, 0);
  return (
    <>
      <PageHeader
        title="Estratégias"
        description={`Peso total das estratégias ativas: ${total} pontos. A pontuação não representa probabilidade de lucro.`}
      />
      <QueryView query={strategies} isEmpty={(d) => d.length === 0}>
        {(list) => (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <StrategyCard key={s.id} strategy={s} />
            ))}
          </div>
        )}
      </QueryView>
    </>
  );
}
