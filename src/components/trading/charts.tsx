import { memo } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "./state-views";

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 10, tickLine: false, axisLine: false } as const;
const TOOLTIP = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
} as const;
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export const PerformanceChart = memo(function PerformanceChart({
  data,
}: {
  data: ReadonlyArray<{ t: string; equity: number }>;
}) {
  if (data.length < 2)
    return <EmptyState title="Sem histórico de patrimônio" description="Os snapshots são gravados pelo motor de Paper Trading." />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={[...data]}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" {...AXIS} />
        <YAxis {...AXIS} width={60} domain={["auto", "auto"]} />
        <Tooltip {...TOOLTIP} />
        <Area type="monotone" dataKey="equity" stroke="var(--primary)" fill="url(#eq)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
});

export const PnlBarChart = memo(function PnlBarChart({
  data,
  xKey,
  emptyTitle,
}: {
  data: ReadonlyArray<Record<string, string | number>>;
  xKey: string;
  emptyTitle: string;
}) {
  if (!data.length) return <EmptyState title={emptyTitle} />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={[...data]}>
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} width={50} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="pnl">
          {data.map((d, i) => (
            <Cell key={i} fill={Number(d.pnl) >= 0 ? "var(--gain)" : "var(--loss)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export const DistributionChart = memo(function DistributionChart({
  data,
}: {
  data: ReadonlyArray<{ name: string; value: number }>;
}) {
  if (!data.length) return <EmptyState title="Nenhuma posição aberta" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={[...data]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} stroke="var(--card)">
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
      </PieChart>
    </ResponsiveContainer>
  );
});

export const PriceChart = memo(function PriceChart({ data }: { data: ReadonlyArray<{ t: string; close: number }> }) {
  if (!data.length) return <EmptyState title="Sem candles" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={[...data]}>
        <defs>
          <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" {...AXIS} minTickGap={40} />
        <YAxis {...AXIS} width={70} domain={["auto", "auto"]} />
        <Tooltip {...TOOLTIP} />
        <Area type="monotone" dataKey="close" stroke="var(--primary)" fill="url(#px)" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
});
