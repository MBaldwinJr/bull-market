import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { preparePaperBuy } from "@/features/trading/services/paper-buy.functions";
import { useAuth } from "@/features/auth/use-auth";
import { useAssets, useBotConfig, usePaperAccount, useRiskLimits, useStrategies } from "@/features/account/hooks/use-account";
import { useTickers } from "@/features/market/hooks/use-market";
import { estimatePaperRisk } from "./indicative-paper-risk";
import { assessPaperPreflightReadiness } from "./paper-preflight-readiness";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/trading/panel";
import { canSubmitManualPaperOrder } from "./manual-paper-order-activation";
import { MIN_PAPER_BUY_NOTIONAL_USDT } from "../utils/paper-order-policy";

const fmtUSDT = (value: number, decimals = 8) => value.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
const fmtQuantity = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 10 });

/**
 * Readiness UI only: does not import or call any server submission endpoint.
 * All orders remain disabled until a separately reviewed activation.
 */
export function ManualPaperOrderPreview() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [quantity, setQuantity] = useState("0.001");
  const [stopPrice, setStopPrice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [strategyKey, setStrategyKey] = useState("ema");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  const { session } = useAuth();
  const account = usePaperAccount();
  const bot = useBotConfig();
  const riskLimits = useRiskLimits();
  const assets = useAssets();
  const strategies = useStrategies();
  const tickers = useTickers([symbol]);
  const market = tickers.data?.find((ticker) => ticker.symbol === symbol);
  const indicative = estimatePaperRisk({
    price: market?.lastPrice ?? null,
    quoteTimeMs: market?.fetchedAt ?? null,
    nowMs,
    quantity: Number(quantity), stopPrice: Number(stopPrice),
    initialBalance: Number(account.data?.initial_balance),
    availableCash: Number(account.data?.cash_balance),
    riskPct: Number(riskLimits.data?.max_risk_per_trade_pct),
  });
  const readiness = assessPaperPreflightReadiness({
    symbol, strategyKey,
    account: account.data,
    bot: bot.data,
    limits: riskLimits.data,
    assets: assets.data,
    strategies: strategies.data,
  });
  const prepare = useServerFn(preparePaperBuy);
  const [preflight, setPreflight] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => { setPreflight(null); }, [symbol, quantity, stopPrice, strategyKey, confirmation]);
  const canPrepare = indicative.status === "within_limit" && readiness.status === "preflight_checkable" && /^[A-Z0-9]{2,20}$/.test(symbol) && /^[a-z_]{2,128}$/.test(strategyKey) &&
    quantity.trim().length > 0 && stopPrice.trim().length > 0 &&
    Number.isFinite(Number(quantity)) && Number(quantity) > 0 &&
    Number.isFinite(Number(stopPrice)) && Number(stopPrice) > 0 &&
    confirmation === "CONFIRMAR COMPRA SIMULADA";
  const runPreflight = async () => {
    if (!canPrepare || !session?.access_token || preparing) return;
    setPreparing(true);
    setPreflight(null);
    try {
      const receipt = await prepare({ data: {
        clientOrderId: `preflight-${crypto.randomUUID()}`,
        symbol, strategyKey, quantity: Number(quantity), stopPrice: Number(stopPrice),
      }, headers: { Authorization: `Bearer ${session.access_token}` } });
      if (receipt.status !== "prepared_only" || receipt.executed !== false) {
        throw new Error("Resposta de preparação inesperada");
      }
      setPreflight(`Preparação validada, sem execução: ${receipt.symbol}, quantidade ${fmtQuantity(receipt.quantity)}, cotação ${fmtUSDT(receipt.entryPrice, 4)} USDT, taxa ${fmtUSDT(receipt.fee, 10)} USDT, débito estimado ${fmtUSDT(receipt.totalDebit, 8)} USDT.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeReasons = [
        "Risco por operação excedido", "Stop-loss obrigatório abaixo da entrada",
        "Saldo insuficiente; alavancagem proibida", "Saldo insuficiente para taxa e compra",
        "Cotação indisponível ou desatualizada", "Robô não está em execução",
        "Ativo não autorizado", "Estratégia não autorizada", "Limite de posições atingido",
        "Limite de perda diária atingido",
        "Valor simulado inferior ao mínimo de 5 USDT",
      ];
      const safeReason = safeReasons.find((reason) => message.includes(reason));
      setPreflight(safeReason
        ? `Preparação recusada: ${safeReason}. Nenhuma ordem executada.`
        : "A validação do servidor não foi concluída. Confira sua sessão, os dados de mercado e a configuração de Paper Trading. Nenhuma ordem executada.");
    } finally { setPreparing(false); }
  };
  const eligible = canSubmitManualPaperOrder({ symbol, quantity, stopPrice, confirmation, strategyKey });

  return (
    <Panel title="Compra simulada — preparação">
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        Paper Trading: envio de ordens bloqueado. Preencha os campos apenas para conhecer o fluxo de confirmação.
      </p>
      <div className="mb-3 rounded-md border p-3 text-sm" role="status" aria-live="polite">
        <p className="font-semibold">Pré-verificação de configurações (somente leitura)</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {readiness.messages.map((message) => <li key={message}>{message}</li>)}
        </ul>
        {readiness.status === "blocked" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Configure o ativo e a estratégia manualmente, se desejar. Esta tela não ativa negociações.
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Par
          <Input className="mt-1" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={20} />
        </label>
        <label className="text-sm">Quantidade simulada
          <Input className="mt-1" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="text-sm">Stop-loss (preço do BTC em USDT, não porcentagem)
          <Input className="mt-1" type="number" min="0" step="any" value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)} placeholder="Informe o preço de saída" />
        </label>
        <label className="text-sm">Estratégia
          <Input className="mt-1" value={strategyKey} onChange={(e) => setStrategyKey(e.target.value)} maxLength={128} />
        </label>
        <label className="text-sm">Confirmação
          <Input className="mt-1" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
            placeholder="CONFIRMAR COMPRA SIMULADA" autoComplete="off" />
        </label>
      </div>
      <div className="mt-3 rounded-md border p-3 text-sm" role="status" aria-live="polite">
        <p className="font-medium">Estimativa de risco (somente leitura)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O stop-loss é o preço de saída de 1 BTC em USDT. Não digite a quantidade de BTC nem um percentual.
        </p>
        {indicative.status === "unavailable" ? (
          <p className="mt-2 text-xs">{indicative.reason}</p>
        ) : (
          <>
            <p className="mt-2">Preço de referência: {indicative.entry.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} USDT
              {" · "}Fonte: {market?.source === "kraken_public" ? "Kraken" : "Binance"}
            </p>
            <p>Risco estimado até o stop: {indicative.risk.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} USDT
              {" · "}Limite: {indicative.riskLimit.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} USDT
            </p>
            <p>Valor nominal estimado: {fmtUSDT(indicative.notional, 8)} USDT
              {" · "}Mínimo operacional do simulador: {fmtUSDT(MIN_PAPER_BUY_NOTIONAL_USDT, 2)} USDT.
            </p>
            <p>{indicative.lowestStop === null
              ? "O limite de risco não define um stop mínimo positivo para essa quantidade. O stop deve ser maior que zero e menor que a entrada."
              : `Stop mínimo aproximado para o limite atual: ${fmtUSDT(indicative.lowestStop, 4)} USDT.`}
            </p>
            <p className={indicative.status === "rejected" ? "mt-2 text-loss" : "mt-2 text-gain"}>
              {indicative.reason}
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Estimativa local com preço público; não garante aprovação.
          O servidor consulta novamente a cotação e os limites antes de validar.</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Valor mínimo de teste: 5 USDT (regra interna do Bull Market, não um limite oficial da corretora).
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        A pré-verificação não substitui a validação no servidor. A cotação, o saldo e o risco serão reavaliados no teste sem executar.
        Nenhum preço ou valor será enviado a uma corretora.
      </p>
      <button type="button" onClick={() => void runPreflight()} disabled={!canPrepare || preparing} className="mt-3 mr-2 rounded-md border px-4 py-2 text-sm">
        {preparing ? "Verificando…" : "Validar compra sem executar"}
      </button>
      {preflight ? <p role="status" className="mt-2 text-sm">{preflight}</p> : null}
      <button type="button" disabled={!eligible} className="mt-3 rounded-md border px-4 py-2 text-sm opacity-50" aria-label="Envio de compra simulada desabilitado">
        Envio desabilitado
      </button>
    </Panel>
  );
}
