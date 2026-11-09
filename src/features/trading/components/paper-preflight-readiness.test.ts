import { describe, expect, it } from "vitest";
import { assessPaperPreflightReadiness, type PaperReadinessInput } from "./paper-preflight-readiness";

function fixture(): PaperReadinessInput {
  return {
    symbol: "BTCUSDT", strategyKey: "ema",
    account: { status: "active", source: "paper", initial_balance: 100, cash_balance: 100 },
    bot: { trading_mode: "paper", status: "running",
      live_trading_enabled: false, allow_withdrawals: false },
    limits: { status: "active", leverage: 0, stop_loss_required: true },
    assets: [{ symbol: "BTCUSDT", status: "active", deleted_at: null, auto_trade_enabled: true }],
    strategies: [{ strategy_key: "ema", status: "active", enabled: true }],
  };
}

describe("paper preflight readiness is read-only and fail-closed", () => {
  it("does not claim readiness when any data source is missing", () => {
    expect(assessPaperPreflightReadiness({ ...fixture(), strategies: undefined }).status)
      .toBe("unverified");
    expect(assessPaperPreflightReadiness({ ...fixture(), assets: null }).status)
      .toBe("unverified");
  });

  it("explains disabled asset and strategy without silently enabling them", () => {
    const data = fixture();
    const result = assessPaperPreflightReadiness({
      ...data,
      assets: data.assets?.map((asset) => ({ ...asset, auto_trade_enabled: false })),
      strategies: data.strategies?.map((strategy) => ({ ...strategy, enabled: false })),
    });
    expect(result.status).toBe("blocked");
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.stringContaining("ativo BTCUSDT"),
      expect.stringContaining("estratégia ema"),
    ]));
    expect(data.assets?.[0]?.auto_trade_enabled).toBe(true);
    expect(data.strategies?.[0]?.enabled).toBe(true);
  });

  it("blocks non-paper modes, withdrawals, leverage, missing stop and stopped bot", () => {
    const data = fixture();
    const result = assessPaperPreflightReadiness({
      ...data,
      bot: { ...data.bot!, trading_mode: "testnet", allow_withdrawals: true, status: "stopped" },
      limits: { ...data.limits!, leverage: 1, stop_loss_required: false },
    });
    expect(result.status).toBe("blocked");
    expect(result.messages.length).toBeGreaterThanOrEqual(3);
  });

  it("treats valid configurations as checkable, not authorization to execute", () => {
    const result = assessPaperPreflightReadiness(fixture());
    expect(result.status).toBe("preflight_checkable");
    expect(result.messages[0]).toContain("servidor");
  });

  it("rejects disabled or deleted monitored assets and invalid capital", () => {
    const data = fixture();
    const result = assessPaperPreflightReadiness({
      ...data,
      account: { ...data.account!, cash_balance: 0 },
      assets: [{ symbol: "BTCUSDT", status: "active", deleted_at: "2026-11-08", auto_trade_enabled: true }],
    });
    expect(result.status).toBe("blocked");
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.stringContaining("saldo virtual"),
      expect.stringContaining("ativo BTCUSDT"),
    ]));
  });
});
