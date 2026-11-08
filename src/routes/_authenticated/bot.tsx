import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotStatus } from "@/components/trading/bot-status";
import { EmergencyStop } from "@/components/trading/emergency-stop";
import { PageHeader, Panel, SimulationBadge } from "@/components/trading/panel";
import { QueryView } from "@/components/trading/state-views";
import { accountKeys, useAccountMutation, useBotConfig } from "@/features/account/hooks/use-account";
import { accountService, type BotConfig } from "@/features/account/services/account-service";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/bot")({
  head: () => pageHead("Trading Bot", "Controle do robô de simulação."),
  component: BotPage,
});

function BotPage() {
  const bot = useBotConfig();
  const setStatus = useAccountMutation(
    (a: { id: string; status: BotConfig["status"] }) => accountService.setBotStatus(a.id, a.status),
    [accountKeys.bot],
    "Estado do robô atualizado",
  );

  return (
    <>
      <PageHeader title="Trading Bot" description="O robô opera somente em Paper Trading." actions={<EmergencyStop />} />
      <QueryView query={bot}>
        {(cfg) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Estado">
              <div className="mb-4 flex items-center gap-3">
                <BotStatus status={cfg.status} />
                <SimulationBadge />
              </div>
              <div className="flex flex-wrap gap-2">
                {cfg.status === "stopped" && (
                  <Button onClick={() => setStatus.mutate({ id: cfg.id, status: "running" })} disabled={setStatus.isPending}>
                    <Play className="mr-1 h-4 w-4" /> Iniciar simulação
                  </Button>
                )}
                {cfg.status === "running" && (
                  <Button variant="outline" onClick={() => setStatus.mutate({ id: cfg.id, status: "stopped" })} disabled={setStatus.isPending}>
                    <Pause className="mr-1 h-4 w-4" /> Pausar simulação
                  </Button>
                )}
                {cfg.status === "emergency_stopped" && (
                  <Button variant="outline" onClick={() => setStatus.mutate({ id: cfg.id, status: "stopped" })} disabled={setStatus.isPending}>
                    <RotateCcw className="mr-1 h-4 w-4" /> Liberar bloqueio (fica parado)
                  </Button>
                )}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Este controle grava a autorização de simulação. A execução contínua das ordens simuladas acontece no motor
                FastAPI na VPS, que ainda não está conectado — por isso nenhuma ordem é gerada agora.
              </p>
            </Panel>
            <Panel title="Travas de segurança">
              <dl className="tabular grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Modo</dt>
                <dd>{cfg.trading_mode}</dd>
                <dt className="text-muted-foreground">Operações reais</dt>
                <dd className="text-loss">BLOQUEADAS</dd>
                <dt className="text-muted-foreground">Testnet</dt>
                <dd>{cfg.binance_testnet ? "sim" : "não"}</dd>
                <dt className="text-muted-foreground">Saques via API</dt>
                <dd className="text-loss">PROIBIDOS</dd>
              </dl>
            </Panel>
          </div>
        )}
      </QueryView>
    </>
  );
}
