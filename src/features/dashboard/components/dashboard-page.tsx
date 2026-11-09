import { useMemo } from "react";
import { ManualPaperOrderPreview } from "@/features/trading/components/manual-paper-order-preview";
import { PageHeader, Panel, SimulationBadge } from "@/components/trading/panel";
import { DistributionChart, PerformanceChart, PnlBarChart } from "@/components/trading/charts";
import { ErrorState, LoadingState } from "@/components/trading/state-views";
import { TradingMetricCard, toneFor } from "@/components/trading/trading-metric-card";
import { EmergencyStop } from "@/components/trading/emergency-stop";
import { TradeHistory } from "@/components/trading/trade-history";
import { MarketTicker } from "@/components/trading/market-ticker";
import { useOrders, usePaperAccount, usePositions, useSnapshots } from "@/features/account/hooks/use-account";
import { formatMoney, formatPct, toNumber } from "@/lib/format";
import { computeDashboardMetrics } from "../utils/metrics";

export function DashboardPage() {
  const account = usePaperAccount();
  const positions = usePositions();
  const orders = useOrders();
  const snapshots = useSnapshots();

  const metrics = useMemo(() => {
    if (!account.data || !positions.data || !orders.data || !snapshots.data) return null;
    return computeDashboardMetrics({
      initialBalance: toNumber(account.data.initial_balance),
      cash: toNumber(account.data.cash_balance),
      positions: positions.data,
      totalOrders: orders.data.length,
      equitySeries: snapshots.data.map((s) => toNumber(s.equity)),
      today: new Date().toISOString().slice(0, 10),
    });
  }, [account.data, positions.data, orders.data, snapshots.data]);

  const equitySeries = useMemo(
    () => (snapshots.data ?? []).map((s) => ({ t: s.captured_at.slice(5, 16).replace("T", " "), equity: toNumber(s.equity) })),
    [snapshots.data],
  );

  const error = account.error ?? positions.error ?? orders.error ?? snapshots.error;
  const ccy = account.data?.quote_currency ?? "USDT";
  const openingBalanceMismatch = Boolean(
    account.data && orders.data && positions.data &&
    toNumber(account.data.initial_balance) > 0 &&
    orders.data.length === 0 && positions.data.length === 0 &&
    toNumber(account.data.cash_balance) !== toNumber(account.data.initial_balance),
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resultados da conta de Paper Trading. Nenhum valor representa dinheiro real."
        actions={<EmergencyStop />}
      />
      <MarketTicker />
      <div className="mb-4"><ManualPaperOrderPreview /></div>
      {error ? (
        <ErrorState error={error} onRetry={() => void account.refetch()} />
      ) : !metrics ? (
        <LoadingState rows={4} />
      ) : (
        <>
          {toNumber(account.data?.initial_balance) === 0 && (
            <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              Saldo virtual ainda não definido. Configure o capital simulado em Configurações.
            </div>
          )}
          {openingBalanceMismatch && (
            <div role="alert" className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              Inconsistência na conta simulada: o capital inicial não corresponde ao saldo disponível.
              Os indicadores de rentabilidade estão indisponíveis até a correção do banco.
              Não execute operações enquanto essa divergência persistir.
            </div>
          )}
          <div className="mb-4 flex items-center gap-2">
            <SimulationBadge />
            <span className="text-xs text-muted-foreground">Posições abertas avaliadas ao preço de entrada.</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <TradingMetricCard label="Patrimônio total" value={formatMoney(metrics.equity, ccy)} />
            <TradingMetricCard label="Saldo disponível" value={formatMoney(metrics.cash, ccy)} />
            <TradingMetricCard label="Resultado diário" value={formatMoney(metrics.dailyPnl, ccy)} tone={toneFor(metrics.dailyPnl)} />
            <TradingMetricCard label="Resultado acumulado" value={formatMoney(metrics.totalPnl, ccy)} tone={toneFor(metrics.totalPnl)} hint={`Taxas: ${formatMoney(metrics.fees, ccy)}`} />
            <TradingMetricCard label="Rentabilidade" value={openingBalanceMismatch ? "—" : formatPct(metrics.returnPct)} tone={openingBalanceMismatch ? "neutral" : toneFor(metrics.returnPct)} />
            <TradingMetricCard label="Operações abertas" value={metrics.openPositions} />
            <TradingMetricCard label="Total de ordens" value={metrics.totalTrades} />
            <TradingMetricCard label="Taxa de acerto" value={metrics.winRate === null ? "—" : formatPct(metrics.winRate, 1).replace("+", "")} />
            <TradingMetricCard label="Drawdown máximo" value={`${metrics.maxDrawdownPct.toFixed(2).replace(".", ",")}%`} tone={metrics.maxDrawdownPct > 0 ? "loss" : "neutral"} />
            <TradingMetricCard label="Risco em uso" value={`${metrics.riskUsedPct.toFixed(2).replace(".", ",")}%`} tone={metrics.riskUsedPct > 1 ? "warning" : "neutral"} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title="Evolução do patrimônio" className="lg:col-span-2">
              <PerformanceChart data={equitySeries} />
            </Panel>
            <Panel title="Distribuição por ativo">
              <DistributionChart data={metrics.byAsset} />
            </Panel>
            <Panel title="Lucro / prejuízo diário" className="lg:col-span-2">
              <PnlBarChart data={metrics.dailySeries} xKey="day" emptyTitle="Nenhuma operação encerrada" />
            </Panel>
            <Panel title="Desempenho por estratégia">
              <PnlBarChart data={metrics.byStrategy} xKey="name" emptyTitle="Sem resultados por estratégia" />
            </Panel>
          </div>
          <Panel title="Histórico de operações" className="mt-4">
            <TradeHistory orders={(orders.data ?? []).slice(0, 10)} />
          </Panel>
        </>
      )}
    </>
  );
}
