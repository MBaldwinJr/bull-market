import { describe, expect, it } from "vitest";
import { evaluatePaperEntry, type PaperEntryInput } from "./paper-entry-risk";

const valid: PaperEntryInput = {
  mode: "paper", liveTradingEnabled: false, withdrawalsEnabled: false, botStatus: "running",
  marketFresh: true, balance: 100, equity: 100, dailyRealizedPnl: 0,
  entryPrice: 50, stopPrice: 49, proposedQuantity: 1,
  openPositions: 0, maxOpenPositions: 2, maxRiskPerTradePct: 1, maxDailyLossPct: 3,
};
describe("paper entry risk gate", () => {
  it("permits a fully funded low-risk simulated entry", () => expect(evaluatePaperEntry(valid)).toEqual({ allowed: true, riskAmount: 1, notional: 50 }));
  it.each([
    [{ mode: "live" }, "simulado"],
    [{ liveTradingEnabled: true }, "simulado"],
    [{ withdrawalsEnabled: true }, "simulado"],
    [{ botStatus: "emergency_stopped" }, "execução"],
    [{ marketFresh: false }, "Cotação"],
    [{ balance: 0 }, "Saldo"],
    [{ stopPrice: 51 }, "Stop-loss"],
    [{ openPositions: 2 }, "posições"],
    [{ maxRiskPerTradePct: 3 }, "Limites"],
    [{ dailyRealizedPnl: -3 }, "perda diária"],
    [{ proposedQuantity: 3 }, "Saldo insuficiente"],
    [{ proposedQuantity: 2, stopPrice: 48 }, "Risco"],
    [{ entryPrice: Number.NaN }, "inválidos"],
  ] as const)("blocks unsafe case %j", (patch, reason) => {
    const result = evaluatePaperEntry({ ...valid, ...patch });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain(reason);
  });
});
