import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareAuthenticatedPaperBuy, type PaperBuyState } from "./paper-buy-boundary.server";
import { fetchTrustedPaperQuote } from "./trusted-paper-quote";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const base = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", owner_id: OWNER, status: "active", source: "user", created_at: "", updated_at: "" };
function state(): PaperBuyState {
  return {
    bot: { ...base, trading_mode: "paper", live_trading_enabled: false, allow_withdrawals: false, binance_testnet: true, status: "running" },
    limits: { ...base, max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1, max_open_positions: 2, leverage: 0, stop_loss_required: true, take_profit_pct: null },
    account: { ...base, source: "paper", initial_balance: 100, cash_balance: 100, quote_currency: "USDT", first_trade_at: null },
    positions: [],
    assets: [{ ...base, symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", auto_trade_enabled: true, deleted_at: null }],
    strategies: [{ ...base, strategy_key: "ema", name: "EMA", enabled: true, weight: 30, parameters: {} }],
    duplicateOrder: false,
  };
}
const request = { clientOrderId: "kraken-preflight-001", symbol: "BTCUSDT", strategyKey: "ema", quantity: 0.001, stopPrice: 64900 };
function deps() {
  return {
    verifiedUserId: async () => OWNER,
    serviceCredentialsAvailable: () => true,
    loadState: async () => state(),
    quote: fetchTrustedPaperQuote,
    now: Date.now,
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("Kraken fallback through authenticated paper preparation", () => {
  it("prepares but never executes an order when Binance returns 403", async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: [], result: { XBTUSDT: { c: ["65000", "1"] } } }) });
    vi.stubGlobal("fetch", mock);
    const prepared = await prepareAuthenticatedPaperBuy(request, deps());
    expect(prepared.rpc).toBe("execute_paper_buy");
    expect(prepared.args).toMatchObject({ p_symbol: "BTCUSDT", p_entry_price: 65000, p_stop_loss: 64900, p_quantity: 0.001, p_owner_id: OWNER });
    expect(prepared.totalDebit).toBeCloseTo(65.065);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("fails closed without a usable Binance or Kraken quote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(prepareAuthenticatedPaperBuy(request, deps())).rejects.toThrow();
  });

  it("rejects a fallback quote that exceeds available paper cash", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: [], result: { XBTUSDT: { c: ["200000", "1"] } } }) }));
    await expect(prepareAuthenticatedPaperBuy(request, deps())).rejects.toThrow();
  });
});
