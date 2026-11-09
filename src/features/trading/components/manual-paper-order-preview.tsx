import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/trading/panel";

/**
 * Readiness UI only: does not import or call any server submission endpoint.
 * All orders remain disabled until a separately reviewed activation.
 */
export function ManualPaperOrderPreview() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [quantity, setQuantity] = useState("0.001");
  const [stopPrice, setStopPrice] = useState("");
  const [confirmation, setConfirmation] = useState("");

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
        <label className="text-sm">Confirmação
          <Input className="mt-1" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
            placeholder="CONFIRMAR COMPRA SIMULADA" autoComplete="off" />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Cotação, saldo e limites de risco serão verificados pelo servidor na futura ativação.
        Nenhum preço ou valor será enviado a uma corretora.
      </p>
      <button type="button" disabled className="mt-3 rounded-md border px-4 py-2 text-sm opacity-50" aria-label="Envio de compra simulada desabilitado">
        Envio desabilitado
      </button>
    </Panel>
  );
}
