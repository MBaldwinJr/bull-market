import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/trading/panel";
import { ModulePending } from "@/components/trading/module-pending";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/backtesting")({
  head: () => pageHead("Backtesting", "Testes históricos de estratégias com taxas e slippage."),
  component: () => (
    <>
      <PageHeader title="Backtesting" />
      <ModulePending
        phase="P2"
        dependsOn="motor de backtesting em Python (POST /api/v1/backtest/run)"
        features={[
          "Seleção de ativo, período e estratégia",
          "Simulação de taxas e slippage",
          "Curva de patrimônio e drawdown",
          "Taxa de acerto, profit factor, expectativa",
          "Amostras de treino, validação e teste",
          "Sem vazamento de dados futuros",
        ]}
      />
    </>
  ),
});
