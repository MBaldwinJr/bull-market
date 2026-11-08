import { memo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { accountKeys, useAccountMutation } from "@/features/account/hooks/use-account";
import { accountService, type Strategy } from "@/features/account/services/account-service";

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  trend_following: "Direção e força da tendência.",
  ema: "Cruzamentos das EMAs 9, 21 e 200.",
  rsi: "Sobrecompra e sobrevenda.",
  macd: "Mudanças de momentum.",
  vwap: "Preço em relação ao volume negociado.",
  breakout: "Rompimentos de suporte e resistência.",
  atr: "Volatilidade e dimensionamento de stops.",
};

export const StrategyCard = memo(function StrategyCard({ strategy }: { strategy: Strategy }) {
  const [weight, setWeight] = useState(strategy.weight);
  const update = useAccountMutation(
    (patch: { enabled?: boolean; weight?: number }) => accountService.updateStrategy(strategy.id, patch),
    [accountKeys.strategies],
    "Estratégia atualizada",
  );

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{strategy.name}</h3>
          <p className="text-xs text-muted-foreground">{DESCRIPTIONS[strategy.strategy_key]}</p>
        </div>
        <Switch
          checked={strategy.enabled}
          onCheckedChange={(enabled) => update.mutate({ enabled })}
          aria-label={`Ativar ${strategy.name}`}
        />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Peso</span>
          <span className="tabular text-foreground">{weight}</span>
        </div>
        <Slider
          value={[weight]}
          min={0}
          max={50}
          step={1}
          onValueChange={([v]) => setWeight(v)}
          onValueCommit={([v]) => update.mutate({ weight: v })}
          aria-label={`Peso de ${strategy.name}`}
        />
      </div>
      <pre className="tabular mt-3 overflow-x-auto rounded-sm bg-secondary p-2 text-[11px] text-muted-foreground">
        {JSON.stringify(strategy.parameters)}
      </pre>
    </div>
  );
});
