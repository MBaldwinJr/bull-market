import { cn } from "@/lib/utils";
import type { BotConfig } from "@/features/account/services/account-service";

const LABEL: Readonly<Record<BotConfig["status"], string>> = {
  running: "Simulando",
  stopped: "Parado",
  emergency_stopped: "Emergência",
};

const DOT: Readonly<Record<BotConfig["status"], string>> = {
  running: "bg-gain animate-pulse-dot",
  stopped: "bg-muted-foreground",
  emergency_stopped: "bg-loss animate-pulse-dot",
};

export function BotStatus({ status, compact = false }: { status: BotConfig["status"] | undefined; compact?: boolean }) {
  const s = status ?? "stopped";
  return (
    <span className="inline-flex items-center gap-2 text-xs" aria-label={`Robô: ${LABEL[s]}`}>
      <span className={cn("h-2 w-2 rounded-full", DOT[s])} aria-hidden />
      {!compact && <span className="font-medium">Robô: {LABEL[s]}</span>}
    </span>
  );
}
