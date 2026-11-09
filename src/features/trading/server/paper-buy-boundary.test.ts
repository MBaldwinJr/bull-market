import { describe, expect, it, vi } from "vitest";
import { prepareAuthenticatedPaperBuy, type PaperBuyState } from "./paper-buy-boundary.server";

const OWNER = "verified-owner";
const NOW = Date.parse("2026-11-09T12:00:00Z");
const request = { clientOrderId: "paper-order-0001", symbol: "BTCUSDT", strategyKey: "ema", quantity: 1, stopPrice: 49.5 };
const common = { id: "row", owner_id: OWNER, status: "active", source: "user", created_at: "", updated_at: "" };
function fixture(): PaperBuyState {
  return {
    bot: { ...common, trading_mode: "paper", live_trading_enabled: false, allow_withdrawals: false, binance_testnet: true, status: "running" },
    limits: { ...common, max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1, max_open_positions: 2, leverage: 0, stop_loss_required: true, take_profit_pct: null },
    account: { ...common, initial_balance: 100, cash_balance: 100, quote_currency: "USDT", source: "paper", first_trade_at: null },
    positions: [],
    assets: [{ ...common, symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", auto_trade_enabled: true, deleted_at: null }],
    strategies: [{ ...common, strategy_key: "ema", name: "EMA", enabled: true, weight: 30, parameters: {} }],
    duplicateOrder: false,
  };
}
function setup(state = fixture()) {
  const dependencies = {
    verifiedUserId: vi.fn(async () => OWNER),
    serviceCredentialsAvailable: vi.fn(() => true),
    loadState: vi.fn(async () => state),
    quote: vi.fn(async () => ({ symbol: "BTCUSDT", price: 50, fetchedAt: new Date(NOW).toISOString() })),
    now: () => NOW,
  };
  return dependencies;
}
describe("authenticated preparation-only paper boundary", () => {
  it("prepares exact RPC arguments from verified ownership and trusted price, with 0.1% fee", async () => {
    const deps = setup();
    const result = await prepareAuthenticatedPaperBuy(request, deps);
    expect(deps.loadState).toHaveBeenCalledWith(OWNER, "paper-order-0001");
    expect(result).toEqual({ rpc: "execute_paper_buy", args: {
      p_owner_id: OWNER, p_client_order_id: "paper-order-0001", p_symbol: "BTCUSDT", p_strategy_key: "ema",
      p_quantity: 1, p_entry_price: 50, p_stop_loss: 49.5, p_fee_rate: 0.001, p_quote_at: new Date(NOW).toISOString(),
    }, fee: 0.05, totalDebit: 50.05 });
  });
  it.each(["owner_id", "ownerId", "entryPrice", "feeRate", "quotedAt", "riskLimits"])("rejects browser-controlled %s", async (field) => {
    const deps = setup();
    await expect(prepareAuthenticatedPaperBuy({ ...request, [field]: "forged" }, deps)).rejects.toThrow();
    expect(deps.loadState).not.toHaveBeenCalled();
    expect(deps.quote).not.toHaveBeenCalled();
  });
  it("rejects invalid sessions before any reads", async () => {
    const deps = setup();
    deps.verifiedUserId.mockRejectedValue(new Error("unauthorized"));
    await expect(prepareAuthenticatedPaperBuy(request, deps)).rejects.toThrow("unauthorized");
    expect(deps.loadState).not.toHaveBeenCalled();
  });
  it("fails closed without service credentials before reads or quotes", async () => {
    const deps = setup(); deps.serviceCredentialsAvailable.mockReturnValue(false);
    await expect(prepareAuthenticatedPaperBuy(request, deps)).rejects.toThrow("Credenciais");
    expect(deps.loadState).not.toHaveBeenCalled(); expect(deps.quote).not.toHaveBeenCalled();
  });
  it.each([
    ["foreign owner", (s: PaperBuyState) => ({ ...s, account: { ...s.account, owner_id: "attacker" } })],
    ["live mode", (s: PaperBuyState) => ({ ...s, bot: { ...s.bot, trading_mode: "live" } })],
    ["live flag", (s: PaperBuyState) => ({ ...s, bot: { ...s.bot, live_trading_enabled: true } })],
    ["withdrawals", (s: PaperBuyState) => ({ ...s, bot: { ...s.bot, allow_withdrawals: true } })],
    ["stopped bot", (s: PaperBuyState) => ({ ...s, bot: { ...s.bot, status: "stopped" } })],
    ["leverage", (s: PaperBuyState) => ({ ...s, limits: { ...s.limits, leverage: 1 } })],
    ["optional stop", (s: PaperBuyState) => ({ ...s, limits: { ...s.limits, stop_loss_required: false } })],
    ["disabled asset", (s: PaperBuyState) => ({ ...s, assets: s.assets.map((a) => ({ ...a, auto_trade_enabled: false })) })],
    ["deleted asset", (s: PaperBuyState) => ({ ...s, assets: s.assets.map((a) => ({ ...a, deleted_at: "2026-11-09" })) })],
    ["disabled strategy", (s: PaperBuyState) => ({ ...s, strategies: s.strategies.map((a) => ({ ...a, enabled: false })) })],
    ["duplicate order", (s: PaperBuyState) => ({ ...s, duplicateOrder: true })],
    ["fee exceeds cash", (s: PaperBuyState) => ({ ...s, account: { ...s.account, cash_balance: 50 } })],
  ] as const)("blocks %s", async (_name, patch) => {
    await expect(prepareAuthenticatedPaperBuy(request, setup(patch(fixture())))).rejects.toThrow();
  });
  it("blocks risk above 0.5% and stop at or above entry", async () => {
    await expect(prepareAuthenticatedPaperBuy({ ...request, stopPrice: 49.49 }, setup())).rejects.toThrow("Risco");
    await expect(prepareAuthenticatedPaperBuy({ ...request, stopPrice: 50 }, setup())).rejects.toThrow("Stop-loss");
  });
  it.each([NaN, Infinity, 0, -1])("rejects invalid quantity %s", async (quantity) => {
    await expect(prepareAuthenticatedPaperBuy({ ...request, quantity }, setup())).rejects.toThrow();
  });
  it.each([-1, 30_001, NaN])("rejects future, stale and invalid quote age %s", async (age) => {
    const deps = setup(); deps.quote.mockResolvedValue({ symbol: "BTCUSDT", price: 50, fetchedAt: Number.isNaN(age) ? "bad" : new Date(NOW - age).toISOString() });
    await expect(prepareAuthenticatedPaperBuy(request, deps)).rejects.toThrow("Cotação");
  });
  it("accepts exactly 30-second-old price and rejects price failures", async () => {
    const deps = setup(); deps.quote.mockResolvedValue({ symbol: "BTCUSDT", price: 50, fetchedAt: new Date(NOW - 30_000).toISOString() });
    expect((await prepareAuthenticatedPaperBuy(request, deps)).args.p_entry_price).toBe(50);
    deps.quote.mockRejectedValue(new Error("offline"));
    await expect(prepareAuthenticatedPaperBuy(request, deps)).rejects.toThrow("offline");
  });
  function position(status: "open" | "closed", pnl = 0): PaperBuyState["positions"][number] {
    return { ...common, source: "paper", account_id: "row", symbol: "BTCUSDT", side: "long", quantity: 1, entry_price: 50, stop_loss: 49.5, take_profit: null, exit_price: null, fees_paid: 0.05, realized_pnl: pnl, strategy_key: "ema", status, opened_at: "", closed_at: new Date(NOW).toISOString() };
  }
  it("blocks two simultaneous positions", async () => {
    await expect(prepareAuthenticatedPaperBuy(request, setup({ ...fixture(), positions: [position("open"), position("open")] }))).rejects.toThrow("posições");
  });
  it("blocks exactly 1% daily realized loss against opening capital", async () => {
    await expect(prepareAuthenticatedPaperBuy(request, setup({ ...fixture(), positions: [position("closed", -1)] }))).rejects.toThrow("perda diária");
  });
  it("uses UTC day and excludes previous-day results", async () => {
    const previous = { ...position("closed", -100), closed_at: "2026-11-08T23:59:59Z" };
    expect((await prepareAuthenticatedPaperBuy(request, setup({ ...fixture(), positions: [previous] }))).rpc).toBe("execute_paper_buy");
  });
});