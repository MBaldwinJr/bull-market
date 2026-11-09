import { memo, useMemo } from "react";
import { SignalIndicator } from "@/components/trading/signal-indicator";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCandles } from "../hooks/use-market";
import { closedCandles, computeIndicators } from "../utils/indicators";

const fmt = (n: number | null) => (n === null ? "—" : formatPrice(n));

export const SignalRow = memo(function SignalRow({ symbol }: { symbol: string }) {
  const candles = useCandles(symbol, "1h");
  const snap = useMemo(
    () => (candles.data ? computeIndicators(closedCandles(candles.data, Date.now())) : null),
    [candles.data],
  );

  return (
    <div className="grid gap-2 py-3 md:grid-cols-[120px_1fr_auto] md:items-center">
      <div className="font-semibold">{symbol}</div>
      {candles.isLoading ? (
        <span className="text-xs text-muted-foreground">Calculando…</span>
      ) : candles.error || !snap ? (
        <span className="text-xs text-loss">Dados insuficientes ou desatualizados — sem decisão.</span>
      ) : (
        <div className="tabular grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
          <span>Fonte <b className="text-foreground">{candles.data?.[0]?.source === "kraken_public" ? "Kraken" : "Binance"}</b></span>
          <span>EMA9 <b className="text-foreground">{fmt(snap.ema9)}</b></span>
          <span>EMA21 <b className="text-foreground">{fmt(snap.ema21)}</b></span>
          <span>EMA200 <b className="text-foreground">{fmt(snap.ema200)}</b></span>
          <span>RSI14 <b className="text-foreground">{snap.rsi14?.toFixed(1) ?? "—"}</b></span>
          <span>ATR14 <b className="text-foreground">{fmt(snap.atr14)}</b></span>
          <span>VWAP24 <b className="text-foreground">{fmt(snap.vwap)}</b></span>
          <span>
            Tendência{" "}
            <b className={cn(snap.trend === "alta" ? "text-gain" : snap.trend === "baixa" ? "text-loss" : "text-warning")}>
              {snap.trend}
            </b>
          </span>
          <span>Candles <b className="text-foreground">{snap.candlesUsed}</b></span>
        </div>
      )}
      {snap && !candles.error && <SignalIndicator score={snap.score} />}
    </div>
  );
});
