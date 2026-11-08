import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountKeys, useAccountMutation } from "@/features/account/hooks/use-account";
import { accountService, type RiskLimits } from "@/features/account/services/account-service";
import { riskLimitsSchema, type RiskLimitsInput } from "@/features/account/schemas";
import { toNumber } from "@/lib/format";

const FIELDS: ReadonlyArray<{ name: keyof RiskLimitsInput; label: string; step: string }> = [
  { name: "max_risk_per_trade_pct", label: "Risco máximo por operação (%)", step: "0.05" },
  { name: "max_daily_loss_pct", label: "Perda diária máxima (%)", step: "0.1" },
  { name: "max_open_positions", label: "Posições simultâneas", step: "1" },
  { name: "take_profit_pct", label: "Take-profit (%) — opcional", step: "0.1" },
];

export function RiskPanel({ limits }: { limits: RiskLimits }) {
  const form = useForm<RiskLimitsInput>({
    resolver: zodResolver(riskLimitsSchema),
    defaultValues: {
      max_risk_per_trade_pct: toNumber(limits.max_risk_per_trade_pct),
      max_daily_loss_pct: toNumber(limits.max_daily_loss_pct),
      max_open_positions: limits.max_open_positions,
      take_profit_pct: limits.take_profit_pct === null ? null : toNumber(limits.take_profit_pct),
    },
  });
  const save = useAccountMutation(
    (input: RiskLimitsInput) => accountService.updateRiskLimits(limits.id, input),
    [accountKeys.risk],
    "Limites de risco salvos",
  );

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3" noValidate>
      {FIELDS.map((f) => (
        <div key={f.name} className="space-y-1">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input
            id={f.name}
            type="number"
            step={f.step}
            {...form.register(f.name, { setValueAs: (v: string) => (v === "" ? null : Number(v)) })}
          />
          {form.formState.errors[f.name] && (
            <p className="text-xs text-loss">{form.formState.errors[f.name]?.message}</p>
          )}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 rounded-sm bg-secondary p-3 text-xs">
        <span className="text-muted-foreground">Alavancagem</span>
        <span className="tabular">0 (fixa)</span>
        <span className="text-muted-foreground">Stop-loss</span>
        <span>Obrigatório (fixo)</span>
      </div>
      <Button type="submit" disabled={save.isPending}>
        Salvar limites
      </Button>
    </form>
  );
}
