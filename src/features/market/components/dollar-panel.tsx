import { Panel } from "@/components/trading/panel";
import { QueryView } from "@/components/trading/state-views";
import { formatPct } from "@/lib/format";
import { useDollarQuotes } from "../hooks/use-market";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

const fmt = (n: number | null, d = 4) => (n === null ? "indisponível" : n.toFixed(d).replace(".", ","));

export function DollarPanel() {
  const q = useDollarQuotes();
  return (
    <Panel title="Mercado de dólar">
      <QueryView query={q}>
        {(d) => {
          const premium = d.usdBrl && d.usdtBrl ? ((d.usdtBrl - d.usdBrl) / d.usdBrl) * 100 : null;
          return (
            <>
              <Row label="USD/BRL (referência)" value={fmt(d.usdBrl)} />
              <Row label="USDT/BRL (Binance)" value={fmt(d.usdtBrl)} />
              <Row label="USDC/USDT (Binance)" value={fmt(d.usdcUsdt)} />
              <Row label="Prêmio USDT vs referência" value={premium === null ? "—" : formatPct(premium, 3)} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Diferença bruta, sem taxas, spreads ou custos de transferência — não é oportunidade de arbitragem. Forex: integração futura.
                Fonte de referência: {d.referenceSource}.
              </p>
            </>
          );
        }}
      </QueryView>
    </Panel>
  );
}
