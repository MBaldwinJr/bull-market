import { useExchangeHealth } from "@/features/market/hooks/use-market";
import { Panel } from "@/components/trading/panel";

const reasons = {
  timeout: "Tempo limite excedido ao consultar a Binance.",
  network: "Falha de rede ou bloqueio na comunicação com a Binance.",
  http_error: "A Binance recusou ou não conseguiu processar a consulta.",
  invalid_response: "A Binance não retornou uma cotação BTC/USDT válida.",
} as const;

/** Read-only connection diagnostic. Does not activate any trading feature. */
export function BinanceHealthDiagnostic() {
  const health = useExchangeHealth();
  const data = health.data;
  return (
    <Panel title="Diagnóstico de fontes públicas — BTC/USDT">
      {health.isPending ? (
        <p className="text-sm text-muted-foreground">Verificando cotação BTC/USDT…</p>
      ) : health.error ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível verificar a conexão. As operações simuladas devem permanecer bloqueadas.
        </p>
      ) : data?.binancePublic ? (
        <p role="status" className="text-sm text-gain">
          Cotação BTC/USDT da Binance validada. Latência: {data.latencyMs ?? "—"} ms.
          Isso não autoriza o envio de ordens.
        </p>
      ) : (
        <div role="alert" className="space-y-1 text-sm">
          <p className="text-destructive">Binance indisponível. Compras bloqueadas.</p>
          <p>{data?.failureReason ? reasons[data.failureReason] : "Falha não classificada."}</p>
          {data?.httpStatus ? <p>Código HTTP: {data.httpStatus}</p> : null}
          {data?.fallbackAvailable ? (
            <p className="text-gain">Cotação pública BTC/USDT validada via Kraken. O Dashboard e o Mercado podem usar esses preços como alternativa à Binance. Isso não valida todos os ativos nem libera ordens.</p>
          ) : data?.failureReason === "http_error" ? (
            <p>Cotação alternativa BTC/USDT não confirmada nesta verificação.</p>
          ) : null}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Diagnóstico de leitura pública; não requer API key, Testnet ou conexão de produção.
      </p>
    </Panel>
  );
}
