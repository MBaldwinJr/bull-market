import { useDollarQuotes, useExchangeHealth } from "@/features/market/hooks/use-market";
import { cn } from "@/lib/utils";

type State = "ok" | "down" | "pending" | "not_configured";

const STATE_LABEL: Readonly<Record<State, string>> = {
  ok: "Conectado",
  down: "Falha",
  pending: "Verificando",
  not_configured: "Não configurado",
};
const STATE_CLASS: Readonly<Record<State, string>> = {
  ok: "text-gain",
  down: "text-loss",
  pending: "text-muted-foreground",
  not_configured: "text-warning",
};

function Item({ name, state, detail }: { name: string; state: State; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <span className={cn("text-xs font-semibold uppercase", STATE_CLASS[state])}>{STATE_LABEL[state]}</span>
    </li>
  );
}

export function SystemHealthPanel() {
  const health = useExchangeHealth();
  const dollar = useDollarQuotes();
  const binance: State = health.isLoading ? "pending" : health.data?.binancePublic ? "ok" : "down";
  const usd: State = dollar.isLoading ? "pending" : dollar.data?.usdBrl ? "ok" : "down";
  return (
    <ul className="divide-y">
      <Item name="Binance Spot — dados públicos" state={binance} detail={`Somente leitura de mercado${health.data?.latencyMs != null ? ` · ${health.data.latencyMs}ms` : ""}`} />
      <Item name="Cotação USD/BRL" state={usd} detail="Fonte externa de referência" />
      <Item name="Binance Spot Testnet" state="not_configured" detail="Credenciais exclusivas da Testnet ficarão no backend da VPS (P3)" />
      <Item name="Backend FastAPI" state="not_configured" detail="Motor de estratégias, risco e paper trading na VPS" />
      <Item name="Binance produção" state="not_configured" detail="Bloqueado por design — o cliente de produção nunca é instanciado" />
    </ul>
  );
}
