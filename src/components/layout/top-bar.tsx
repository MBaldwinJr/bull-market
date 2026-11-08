import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRiskEvents } from "@/features/account/hooks/use-account";
import { useExchangeHealth } from "@/features/market/hooks/use-market";
import { TRADING_LOCKS } from "@/lib/trading-config";
import { cn } from "@/lib/utils";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular text-xs text-muted-foreground">{now ? now.toLocaleTimeString("pt-BR") : "--:--:--"}</span>;
}

function Pill({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px]">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", ok === null ? "bg-muted-foreground" : ok ? "bg-gain" : "bg-loss")}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const health = useExchangeHealth();
  const events = useRiskEvents();
  const binanceOk = health.data ? health.data.binancePublic : null;
  const alerts = (events.data ?? []).filter((e) => e.severity !== "info").length;

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex flex-1 flex-wrap items-center gap-2 overflow-hidden">
        <Pill ok={binanceOk} label={binanceOk === null ? "Verificando…" : binanceOk ? "Sistema online" : "Dados indisponíveis"} />
        <span className="rounded-sm bg-warning px-2 py-0.5 text-[11px] font-bold uppercase text-warning-foreground">
          Modo {TRADING_LOCKS.TRADING_MODE}
        </span>
        <span className="hidden sm:inline-flex">
          <Pill
            ok={binanceOk}
            label={`Binance pública${health.data?.latencyMs != null ? ` · ${health.data.latencyMs}ms` : ""}`}
          />
        </span>
      </div>
      <Clock />
      <Button variant="ghost" size="icon" asChild aria-label={`Notificações: ${alerts}`}>
        <Link to="/logs" className="relative">
          <Bell className="h-4 w-4" />
          {alerts > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-loss" aria-hidden />
          )}
        </Link>
      </Button>
    </header>
  );
}
