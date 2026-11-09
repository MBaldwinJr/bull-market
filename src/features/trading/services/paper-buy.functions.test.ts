import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  middleware: { verifiedAuth: true },
  middlewareSpy: vi.fn(),
  prepare: vi.fn(),
  load: vi.fn(),
  quote: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: mocks.middleware }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: (value: unknown) => { mocks.middlewareSpy(value); return builder; },
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("../server/paper-buy-boundary.server", () => ({ prepareAuthenticatedPaperBuy: mocks.prepare }));
vi.mock("../server/paper-buy-repository.server", () => ({ loadPaperBuyState: mocks.load }));
vi.mock("../server/trusted-paper-quote", () => ({ fetchTrustedPaperQuote: mocks.quote }));

import { preparePaperBuy } from "./paper-buy.functions";
import type { PaperBuyDependencies } from "../server/paper-buy-boundary.server";

interface TestContext {
  readonly userId: string;
  readonly supabase: { readonly auth: { readonly getUser: () => Promise<{
    data: { user: { id: string } | null }; error: { message: string } | null;
  }> } };
}
const invoke = preparePaperBuy as unknown as (input: { data: unknown; context: TestContext }) => Promise<unknown>;
const request = { clientOrderId: "paper-0001", symbol: "BTCUSDT", strategyKey: "ema", quantity: 1, stopPrice: 49.5 };
beforeEach(() => { mocks.prepare.mockReset(); mocks.load.mockReset(); mocks.quote.mockReset(); });
describe("server function authentication and response boundary", () => {
  it("registers verified auth middleware", () => {
    expect(mocks.middlewareSpy).toHaveBeenCalledWith([mocks.middleware]);
  });
  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "other-owner" } }, error: null },
    { data: { user: { id: "verified-owner" } }, error: { message: "revoked" } },
  ])("rejects missing, mismatched or revoked sessions", async (session) => {
    mocks.prepare.mockImplementation(async (_data: unknown, deps: PaperBuyDependencies) => {
      await deps.verifiedUserId();
    });
    const getUser = vi.fn(async () => session);
    await expect(invoke({ data: request, context: { userId: "verified-owner", supabase: { auth: { getUser } } } })).rejects.toThrow("Sessão inválida");
    expect(getUser).toHaveBeenCalledOnce(); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("revalidates session and returns only a non-executing receipt, never RPC args", async () => {
    mocks.prepare.mockImplementation(async (_data: unknown, deps: PaperBuyDependencies) => {
      const ownerId = await deps.verifiedUserId();
      await deps.loadState(ownerId, "paper-0001");
      return { rpc: "execute_paper_buy", args: { p_owner_id: ownerId, p_symbol: "BTCUSDT", p_quantity: 1, p_entry_price: 50 }, fee: 0.05, totalDebit: 50.05 };
    });
    const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "verified-owner" } }, error: null })) } };
    const result = await invoke({ data: request, context: { userId: "verified-owner", supabase: client } });
    expect(mocks.load).toHaveBeenCalledWith(client, "verified-owner", "paper-0001");
    expect(result).toEqual({ status: "prepared_only", executed: false, symbol: "BTCUSDT", quantity: 1, entryPrice: 50, fee: 0.05, totalDebit: 50.05 });
  });
});