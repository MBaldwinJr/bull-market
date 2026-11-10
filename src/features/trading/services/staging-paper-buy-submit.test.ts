import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitControlledPaperBuy } from "./paper-buy-submit.functions";
import { loadPaperBuyState } from "../server/paper-buy-repository.server";
import { fetchTrustedPaperQuote } from "../server/trusted-paper-quote";
import { createClient } from "@supabase/supabase-js";
import type { PaperBuyState } from "../server/paper-buy-boundary.server";
import { HOMOLOGATION_APP_ID } from "../server/staging-paper-activation.server";

const rpc = vi.hoisted(() => vi.fn(async () => ({
  data: "11111111-1111-4111-8111-111111111111", error: null,
})));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: (input: unknown) => unknown = (input) => input;
    const builder = {
      middleware() { return builder; },
      inputValidator(fn: (input: unknown) => unknown) { validator = fn; return builder; },
      handler(fn: (args: { data: unknown; context: unknown }) => Promise<unknown>) {
        return async (args: { data: unknown; context: unknown }) =>
          fn({ ...args, data: validator(args.data) });
      },
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ rpc })) }));
vi.mock("../server/paper-buy-repository.server", () => ({ loadPaperBuyState: vi.fn() }));
vi.mock("../server/trusted-paper-quote", () => ({ fetchTrustedPaperQuote: vi.fn() }));

const REF = "stagingreference12345";
const URL = `https://${REF}.supabase.co`;
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const environment = {
  BULL_MARKET_ENVIRONMENT: "homologacao",
  BULL_MARKET_APP_ID: HOMOLOGATION_APP_ID,
  PAPER_STAGING_APPROVED_APP_ID: HOMOLOGATION_APP_ID,
  PAPER_TRADING_ROUTE_ENABLED: "true",
  PAPER_TRADING_EXECUTION_ENABLED: "true",
  PAPER_STAGING_APPROVED_PROJECT_REF: REF,
  VITE_SUPABASE_PROJECT_ID: REF,
  PAPER_STAGING_APPROVED_SUPABASE_URL: URL,
  SUPABASE_URL: URL,
  VITE_SUPABASE_URL: URL,
  SUPABASE_SERVICE_ROLE_KEY: "fake-local-test-only",
} as const;
const initialEnv = Object.fromEntries(
  Object.keys(environment).map((key) => [key, process.env[key]]),
);

function fixture(): PaperBuyState {
  const common = { id: OWNER, owner_id: OWNER, status: "active", source: "user", created_at: "", updated_at: "" };
  return {
    bot: { ...common, trading_mode: "paper", live_trading_enabled: false,
      allow_withdrawals: false, binance_testnet: true, status: "running" },
    account: { ...common, initial_balance: 100, cash_balance: 100,
      quote_currency: "USDT", source: "paper", first_trade_at: null },
    limits: { ...common, max_risk_per_trade_pct: 0.5, max_daily_loss_pct: 1,
      max_open_positions: 1, leverage: 0, stop_loss_required: true, take_profit_pct: null },
    assets: [{ ...common, symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT",
      auto_trade_enabled: true, deleted_at: null }],
    strategies: [{ ...common, strategy_key: "ema", name: "EMA", enabled: true,
      weight: 100, parameters: {} }],
    positions: [],
    duplicateOrder: false,
  };
}
const context = {
  userId: OWNER,
  supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: OWNER } }, error: null })) } },
};
const request = {
  clientOrderId: "staging-only-00001",
  symbol: "BTCUSDT", strategyKey: "ema",
  quantity: 0.1, stopPrice: 49.75,
  confirmation: "CONFIRMAR COMPRA SIMULADA",
};
const submit = submitControlledPaperBuy as unknown as (args: {
  data: unknown; context: typeof context;
}) => Promise<{ status: string; executed: boolean; orderId?: string }>;

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(environment)) process.env[key] = value;
  vi.mocked(loadPaperBuyState).mockResolvedValue(fixture());
  vi.mocked(fetchTrustedPaperQuote).mockResolvedValue({
    symbol: "BTCUSDT", price: 50, fetchedAt: new Date().toISOString(),
  });
});

afterEach(() => {
  for (const key of Object.keys(environment)) {
    const prior = initialEnv[key];
    if (prior === undefined) delete process.env[key];
    else process.env[key] = prior;
  }
});

describe("staging simulated purchase route", () => {
  it("simulates a single 5 USDT buy only when both flags and staging identity are correct", async () => {
    const response = await submit({ data: request, context });
    expect(response).toMatchObject({ status: "executed", executed: true });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("execute_paper_buy", expect.objectContaining({
      p_owner_id: OWNER, p_client_order_id: request.clientOrderId,
      p_symbol: "BTCUSDT", p_quantity: 0.1, p_entry_price: 50,
    }));
    expect(createClient).toHaveBeenCalledOnce();
  });

  it.each([
    ["route disabled", { PAPER_TRADING_ROUTE_ENABLED: "false" }],
    ["execution disabled", { PAPER_TRADING_EXECUTION_ENABLED: "false" }],
    ["wrong app", { BULL_MARKET_APP_ID: "53ab617e-c9fb-449d-a719-311a513d4a02" }],
    ["production backend", { SUPABASE_URL: "https://dsrjwmpvauipdssopydg.supabase.co" }],
    ["missing approved URL", { PAPER_STAGING_APPROVED_SUPABASE_URL: "" }],
  ])("fails closed for %s", async (_name, patch) => {
    Object.assign(process.env, patch);
    expect(await submit({ data: request, context })).toEqual({
      status: "execution_disabled", executed: false,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(loadPaperBuyState).not.toHaveBeenCalled();
  });

  it("rejects a valid but too large paper purchase, without touching RPC", async () => {
    await expect(submit({ data: { ...request, quantity: 0.201 }, context })).rejects.toThrow("10 USDT");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a real-mode bot before any simulated execution", async () => {
    const state = fixture();
    vi.mocked(loadPaperBuyState).mockResolvedValue({
      ...state, bot: { ...state.bot, live_trading_enabled: true },
    });
    await expect(submit({ data: request, context })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects permissive risk limits despite a valid 5 USDT plan", async () => {
    const state = fixture();
    vi.mocked(loadPaperBuyState).mockResolvedValue({
      ...state, limits: { ...state.limits, max_risk_per_trade_pct: 1 },
    });
    await expect(submit({ data: request, context })).rejects.toThrow("Limites de risco");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires explicit manual confirmation", async () => {
    await expect(submit({ data: { ...request, confirmation: "SIM" }, context })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
