import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "gain" | "loss" | "warning";

const TONE: Readonly<Record<Tone, string>> = {
  neutral: "text-foreground",
  gain: "text-gain",
  loss: "text-loss",
  warning: "text-warning",
};

export function toneFor(value: number): Tone {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "neutral";
}

export const TradingMetricCard = memo(function TradingMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={cn("tabular mt-1.5 truncate text-lg font-semibold", TONE[tone])}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
});
