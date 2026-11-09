import { beforeEach, describe, expect, it, vi } from "vitest";
import { preparePaperBuy } from "./paper-buy.functions";
import { loadPaperBuyState } from "../server/paper-buy-repository.server";
import { fetchTrustedPaperQuote } from "../server/trusted-paper-quote";
import type { PaperBuyState } from "../server/paper-buy-boundary.server";

// Test the actual server handler and its actual authenticated risk boundary.
// Only the TanStack server-function wrapper, DB reads and market HTTP are mocked.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (input: unknown) => unknown = (input) => input;
    return {
      middleware() { return this; },
      inputValidator(fn: (input: unknown) => unknown) { validate = fn; return this; },
      handler(fn: (input: unknown) => Promise<unknown>) {
        return async (args: { data: unknown; context: unknown }) =>
          fn({ ...args, data: validate(args.data) });
      },
    };
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));
vi.mock("../server/paper-buy-repository.server", () => ({
  loadPaperBuyState: vi.fn(),
}));
vi.mock("../server/trusted-paper-quote", () => ({
  fetchTrustedPaperQuote: vi.fn(),
}));

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = {
  clientOrderId: "prepared-test-0001",
  symbol: "BTCUSDT",
  strategyKey: "ema",
  quantity: 0.1,
  stopPrice: 49.75,
};
const common = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  owner_id: OWNER,
  status: "active",
  source: "user",
  created_at: "",
  updated_at: "",
};

function state(): PaperBuyState {
  return {
    bot: {
      ...common, trading_mode: "paper", live_trading_enabled: false,
      allow_withdrawals: false, binance_testnet: true, status: "running",
    },
    limits: {
      ...common, max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1,
      max_open_positions: 2, leverage: 0, stop_loss_required: true, take_profit_pct: null,
    },
    account: {
      ...common, initial_balance: 100, cash_balance: 100,
      quote_currency: "USDT", source: "paper", first_trade_at: null,
    },
    positions: [],
    assets: [{
      ...common, symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT",
      auto_trade_enabled: true, deleted_at: null,
    }],
    strategies: [{
      ...common, strategy_key: "ema", name: "EMA",
      enabled: true, weight: 100, parameters: {},
    }],
    duplicateOrder: false,
  };
}

function session(authenticatedId: string | null = OWNER, contextId = OWNER) {
  const getUser = vi.fn(async () => ({
    data: { user: authenticatedId ? { id: authenticatedId } : null },
    error: null,
  }));
  const forbidden = vi.fn(() => {
    throw new Error("A preparation endpoint must never write or execute an RPC");
  });
  const supabase = {
    auth: { getUser },
    rpc: forbidden,
    from: forbidden,
  };
  const context = { userId: contextId, supabase };
  return { context, getUser, forbidden };
}

const run = preparePaperBuy as unknown as (args: {
  data: unknown;
  context: ReturnType<typeof session>["context"];
}) => Promise<{
  status: string;
  executed: boolean;
  symbol: string;
  quantity: number;
  entryPrice: number;
  fee: number;
  totalDebit: number;
}>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadPaperBuyState).mockResolvedValue(state());
  vi.mocked(fetchTrustedPaperQuote).mockResolvedValue({
    symbol: "BTCUSDT", price: 50, fetchedAt: new Date().toISOString(),
  });
});

describe("server-side paper buy preparation: never execute", () => {
  it("returns a minimal prepared_only receipt for exactly 5 USDT, never touching a trade RPC", async () => {
    const identity = session();
    const receipt = await run({ data: request, context: identity.context });
    expect(receipt).toEqual({
      status: "prepared_only",
      executed: false,
      symbol: "BTCUSDT",
      quantity: 0.1,
      entryPrice: 50,
      fee: 0.005,
      totalDebit: 5.005,
    });
    expect(Object.keys(receipt).sort()).toEqual(
      ["status", "executed", "symbol", "quantity", "entryPrice", "fee", "totalDebit"].sort(),
    );
    expect(identity.getUser).toHaveBeenCalledTimes(1);
    expect(loadPaperBuyState).toHaveBeenCalledWith(OWNER, request.clientOrderId);
    expect(fetchTrustedPaperQuote).toHaveBeenCalledWith("BTCUSDT");
    expect(identity.forbidden).not.toHaveBeenCalled();
  });

  it("rejects missing or mismatched Auth identities before any DB or market reads", async () => {
    for (const identity of [session(null), session(OTHER)]) {
      await expect(run({ data: request, context: identity.context })).rejects.toThrow("Sessão inválida");
      expect(identity.forbidden).not.toHaveBeenCalled();
    }
    expect(loadPaperBuyState).not.toHaveBeenCalled();
    expect(fetchTrustedPaperQuote).not.toHaveBeenCalled();
  });

  it("rejects forged browser-controlled owner, quote, mode and execution flags", async () => {
    const identity = session();
    for (const injection of [
      { owner_id: OTHER },
      { p_owner_id: OTHER },
      { entryPrice: 0.01 },
      { quoteAt: new Date().toISOString() },
      { live_trading_enabled: true },
      { execute: true },
    ]) {
      await expect(run({ data: { ...request, ...injection }, context: identity.context })).rejects.toThrow();
    }
    expect(loadPaperBuyState).not.toHaveBeenCalled();
    expect(fetchTrustedPaperQuote).not.toHaveBeenCalled();
    expect(identity.forbidden).not.toHaveBeenCalled();
  });

  it("rejects a nominal value below 5 USDT with no writes", async () => {
    const identity = session();
    await expect(run({
      data: { ...request, quantity: 0.09998 },
      context: identity.context,
    })).rejects.toThrow("Valor simulado inferior ao mínimo de 5 USDT");
    expect(identity.forbidden).not.toHaveBeenCalled();
  });

  it("blocks a stopped robot, disabled strategy, or duplicate order", async () => {
    const identity = session();
    const base = state();
    for (const invalid of [
      { ...base, bot: { ...base.bot, status: "stopped" } },
      { ...base, strategies: [{ ...base.strategies[0], enabled: false }] },
      { ...base, duplicateOrder: true },
    ]) {
      vi.mocked(loadPaperBuyState).mockResolvedValueOnce(invalid as PaperBuyState);
      await expect(run({ data: request, context: identity.context })).rejects.toThrow();
    }
    expect(fetchTrustedPaperQuote).not.toHaveBeenCalled();
    expect(identity.forbidden).not.toHaveBeenCalled();
  });

  it("rejects stale market quotes without execution", async () => {
    const identity = session();
    vi.mocked(fetchTrustedPaperQuote).mockResolvedValue({
      symbol: "BTCUSDT", price: 50, fetchedAt: new Date(Date.now() - 31_000).toISOString(),
    });
    await expect(run({ data: request, context: identity.context })).rejects.toThrow("Cotação");
    expect(identity.forbidden).not.toHaveBeenCalled();
  });
});
