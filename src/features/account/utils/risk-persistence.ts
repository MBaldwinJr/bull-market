import type { RiskLimits } from "../services/account-service";
import type { RiskLimitsInput } from "../schemas";

/** Rejects a positive UI acknowledgement when the database stored different limits. */
export function assertPersistedRiskLimits(
  row: RiskLimits,
  expected: { id: string; ownerId: string; input: RiskLimitsInput },
): void {
  if (row.id !== expected.id || row.owner_id !== expected.ownerId) {
    throw new Error("Conta dos limites de risco não corresponde ao usuário autenticado");
  }
  const { input } = expected;
  if (Number(row.max_risk_per_trade_pct) !== input.max_risk_per_trade_pct ||
      Number(row.max_daily_loss_pct) !== input.max_daily_loss_pct ||
      row.max_open_positions !== input.max_open_positions ||
      (row.take_profit_pct === null ? null : Number(row.take_profit_pct)) !== input.take_profit_pct) {
    throw new Error("O banco não confirmou os limites de risco solicitados");
  }
  if (row.leverage !== 0 || row.stop_loss_required !== true) {
    throw new Error("Proteções de alavancagem ou stop-loss inconsistentes");
  }
}
