import type { RiskEvent } from "@/features/account/services/account-service";
import { cn } from "@/lib/utils";
import { EmptyState } from "./state-views";

const SEV: Readonly<Record<string, string>> = {
  info: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-loss",
};

export function RiskEventList({ events }: { events: readonly RiskEvent[] }) {
  if (!events.length) return <EmptyState title="Nenhum evento de risco registrado" />;
  return (
    <ul className="divide-y text-sm">
      {events.map((e) => (
        <li key={e.id} className="py-2">
          <div className="flex justify-between gap-2">
            <span className={cn("text-xs font-semibold uppercase", SEV[e.severity])}>{e.event_type}</span>
            <time className="tabular text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</time>
          </div>
          <p>{e.message}</p>
        </li>
      ))}
    </ul>
  );
}
