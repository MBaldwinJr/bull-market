import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/trading/panel";
import { QueryView } from "@/components/trading/state-views";
import { SignalRow } from "@/features/market/components/signal-row";
import { useAssets } from "@/features/account/hooks/use-account";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/sinais")({
  head: () => pageHead("Sinais de mercado", "Indicadores técnicos e pontuação reproduzível por ativo."),
  component: SignalsPage,
});

function SignalsPage() {
  const assets = useAssets();
  return (
    <>
      <PageHeader
        title="Sinais de mercado"
        description="Calculados somente com candles de 1h já encerrados. Pontuação 0–100 não é probabilidade de lucro."
      />
      <Panel>
        <QueryView query={assets} isEmpty={(d) => d.length === 0}>
          {(list) => (
            <div className="divide-y">
              {list.map((a) => (
                <SignalRow key={a.id} symbol={a.symbol} />
              ))}
            </div>
          )}
        </QueryView>
      </Panel>
    </>
  );
}
