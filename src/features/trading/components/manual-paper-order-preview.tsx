import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { preparePaperBuy } from "@/features/trading/services/paper-buy.functions";
import { useAuth } from "@/features/auth/use-auth";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/trading/panel";
import { canSubmitManualPaperOrder } from "./manual-paper-order-activation";

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
  const { session } = useAuth();
  const prepare = useServerFn(preparePaperBuy);
  const [preflight, setPreflight] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const canPrepare = /^[A-Z0-9]{2,20}$/.test(symbol) && /^[a-z_]{2,128}$/.test(strategyKey) &&
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
      setPreflight(`Preparação validada, sem execução: ${receipt.symbol}, ${receipt.quantity}, cotação ${receipt.entryPrice} USDT, taxa ${receipt.fee} USDT, débito estimado ${receipt.totalDebit} USDT.`);
    } catch {
      setPreflight("Preparação recusada pelo servidor. Verifique conexão, saldo virtual, configurações de risco, ativo e estratégia habilitados.");
    } finally { setPreparing(false); }
  };
  const eligible = canSubmitManualPaperOrder({ symbol, quantity, stopPrice, confirmation, strategyKey });

  return (
    <Panel title="Compra simulada — preparação">
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        Paper Trading: envio de ordens bloqueado. Preencha os campos apenas para conhecer o fluxo de confirmação.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Par
          <Input className="mt-1" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={20} />
        </label>
        <label className="text-sm">Quantidade simulada
          <Input className="mt-1" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="text-sm">Stop-loss (USDT)
          <Input className="mt-1" type="number" min="0" step="any" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} />
        </label>
        <label className="text-sm">Estratégia
          <Input className="mt-1" value={strategyKey} onChange={(e) => setStrategyKey(e.target.value)} maxLength={128} />
        </label>
        <label className="text-sm">Confirmação
          <Input className="mt-1" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
            placeholder="CONFIRMAR COMPRA SIMULADA" autoComplete="off" />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Cotação, saldo e limites de risco serão verificados pelo servidor na futura ativação.
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
