import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { PageHeader, Panel } from "@/components/trading/panel";
import { TRADING_LOCKS } from "@/lib/trading-config";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/seguranca")({
  head: () => pageHead("Segurança", "Travas de segurança e proteção contra operações reais."),
  component: SecurityPage,
});

const RULES: readonly string[] = [
  "Chaves privadas de corretora nunca chegam ao navegador.",
  "Todas as tabelas privadas têm RLS: cada usuário vê só os próprios registros.",
  "O banco rejeita live_trading_enabled = true, alavancagem > 0 e saques.",
  "Não existe endpoint para habilitar produção.",
  "A IA não pode enviar ordens, alterar limites ou liberar operações reais.",
  "Toda ação de configuração gera registro de auditoria.",
];

function SecurityPage() {
  return (
    <>
      <PageHeader title="Segurança" description="Estas travas não podem ser alteradas pela interface." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Variáveis de execução">
          <ul className="tabular space-y-2 text-sm">
            {Object.entries(TRADING_LOCKS).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between rounded-sm bg-secondary px-3 py-2">
                <span className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {k}
                </span>
                <span className="text-primary">{String(v)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Garantias">
          <ul className="space-y-2 text-sm">
            {RULES.map((r) => (
              <li key={r} className="before:mr-2 before:text-primary before:content-['✓']">
                {r}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
