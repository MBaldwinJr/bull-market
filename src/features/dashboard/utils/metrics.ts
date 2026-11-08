import { toNumber } from "@/lib/format";

export interface PositionLike {
  readonly symbol: string;
  readonly quantity: number | string;
  readonly entry_price: number | string;
  readonly stop_loss: number | string;
  readonly realized_pnl: number | string | null;
  readonly fees_paid: number | string;
  readonly status: string;
  readonly strategy_key: string | null;
  readonly closed_at: string | null;
}

export interface DashboardMetrics {
  readonly equity: number;
  readonly cash: number;
  readonly dailyPnl: number;
  readonly totalPnl: number;
  readonly returnPct: number;
  readonly openPositions: number;
  readonly totalTrades: number;
  readonly winRate: number | null;
  readonly maxDrawdownPct: number;
  readonly riskUsedPct: number;
  readonly fees: number;
  readonly byAsset: ReadonlyArray<{ name: string; value: number }>;
  readonly byStrategy: ReadonlyArray<{ name: string; pnl: number }>;
  readonly dailySeries: ReadonlyArray<{ day: string; pnl: number }>;
}

export function maxDrawdownPct(equitySeries: readonly number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of equitySeries) {
    peak = Math.max(peak, v);
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - v) / peak) * 100);
  }
  return maxDd;
}

/** Open positions are valued at entry price (cost basis) until the backend publishes marks. */
export function computeDashboardMetrics(input: {
  initialBalance: number;
  cash: number;
  positions: readonly PositionLike[];
  totalOrders: number;
  equitySeries: readonly number[];
  today: string;
}): DashboardMetrics {
  const open = input.positions.filter((p) => p.status === "open");
  const closed = input.positions.filter((p) => p.status === "closed");
  const openValue = open.reduce((s, p) => s + toNumber(p.quantity) * toNumber(p.entry_price), 0);
  const equity = input.cash + openValue;
  const totalPnl = closed.reduce((s, p) => s + toNumber(p.realized_pnl), 0);
  const dailyPnl = closed
    .filter((p) => p.closed_at?.slice(0, 10) === input.today)
    .reduce((s, p) => s + toNumber(p.realized_pnl), 0);
  const wins = closed.filter((p) => toNumber(p.realized_pnl) > 0).length;
  const riskAmount = open.reduce(
    (s, p) => s + Math.max(0, toNumber(p.entry_price) - toNumber(p.stop_loss)) * toNumber(p.quantity),
    0,
  );

  const assetMap = new Map<string, number>();
  for (const p of open) assetMap.set(p.symbol, (assetMap.get(p.symbol) ?? 0) + toNumber(p.quantity) * toNumber(p.entry_price));
  const stratMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  for (const p of closed) {
    const k = p.strategy_key ?? "manual";
    stratMap.set(k, (stratMap.get(k) ?? 0) + toNumber(p.realized_pnl));
    const d = p.closed_at?.slice(0, 10);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + toNumber(p.realized_pnl));
  }

  return {
    equity,
    cash: input.cash,
    dailyPnl,
    totalPnl,
    returnPct: input.initialBalance > 0 ? ((equity - input.initialBalance) / input.initialBalance) * 100 : 0,
    openPositions: open.length,
    totalTrades: input.totalOrders,
    winRate: closed.length ? (wins / closed.length) * 100 : null,
    maxDrawdownPct: maxDrawdownPct(input.equitySeries),
    riskUsedPct: equity > 0 ? (riskAmount / equity) * 100 : 0,
    fees: input.positions.reduce((s, p) => s + toNumber(p.fees_paid), 0),
    byAsset: [...assetMap].map(([name, value]) => ({ name, value })),
    byStrategy: [...stratMap].map(([name, pnl]) => ({ name, pnl })),
    dailySeries: [...dayMap].sort(([a], [b]) => a.localeCompare(b)).map(([day, pnl]) => ({ day, pnl })),
  };
}
