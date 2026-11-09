import { describe, expect, it } from "vitest";
import type { RiskLimits } from "../services/account-service";
import type { RiskLimitsInput } from "../schemas";
import { assertPersistedRiskLimits } from "./risk-persistence";

const input: RiskLimitsInput = {
  max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1,
  max_open_positions: 2, take_profit_pct: null,
};
const row = {
  id: "limits-1", owner_id: "user-1", leverage: 0,
  stop_loss_required: true, max_risk_per_trade_pct: 0.5,
  max_daily_loss_pct: 1, max_open_positions: 2, take_profit_pct: null,
} as RiskLimits;
const expected = { id: "limits-1", ownerId: "user-1", input };

describe("risk limit save acknowledgement", () => {
  it("accepts exact persisted settings only", () => {
    expect(() => assertPersistedRiskLimits(row, expected)).not.toThrow();
  });
  it("rejects cross-owner records", () => {
    expect(() => assertPersistedRiskLimits({ ...row, owner_id: "other" }, expected)).toThrow("Conta");
  });
  it("rejects a rounded or stale database value", () => {
    expect(() => assertPersistedRiskLimits({ ...row, max_risk_per_trade_pct: 0.4 }, expected)).toThrow("não confirmou");
  });
  it("rejects any weakening of fixed safety locks", () => {
    expect(() => assertPersistedRiskLimits({ ...row, leverage: 1 }, expected)).toThrow("Proteções");
    expect(() => assertPersistedRiskLimits({ ...row, stop_loss_required: false }, expected)).toThrow("Proteções");
  });
  it("rejects missing or unconfirmed take-profit changes", () => {
    expect(() => assertPersistedRiskLimits(row, { ...expected,
      input: { ...input, take_profit_pct: 2 } })).toThrow("não confirmou");
  });
});
