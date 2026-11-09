import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadPaperBuyState } from "./paper-buy-repository.server";

describe("owner-scoped read-only repository", () => {
  function setup(fail = false) {
    const reads: { table: string; filters: [string, unknown][] }[] = [];
    const writes = vi.fn(() => { throw new Error("writes forbidden"); });
    const from = vi.fn((table: string) => {
      const read = { table, filters: [] as [string, unknown][] }; reads.push(read);
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { read.filters.push([key, value]); return query; },
        gt: (key: string, value: unknown) => { read.filters.push([key, value]); return query; },
        order: () => query, limit: () => query, single: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
          error: fail ? { message: "offline" } : null,
          data: ["bot_config", "risk_limits", "paper_accounts"].includes(table) ? { id: "account" } : [],
        })),
        insert: writes, update: writes, delete: writes, upsert: writes,
      };
      return query;
    });
    const client = { from, rpc: writes };
    return { client: client as unknown as SupabaseClient<Database>, reads, writes };
  }
  it("filters every table by verified owner and never executes RPC or writes", async () => {
    const mock = setup();
    const result = await loadPaperBuyState(mock.client, "session-owner", "order-0001");
    expect(mock.reads.map((read) => read.table)).toEqual([
      "bot_config", "risk_limits", "paper_accounts", "assets", "trading_strategies", "paper_orders", "paper_positions",
    ]);
    for (const read of mock.reads) expect(read.filters).toContainEqual(["owner_id", "session-owner"]);
    expect(mock.reads.at(-1)?.filters).toContainEqual(["account_id", "account"]);
    expect(result.duplicateOrder).toBe(false);
    expect(mock.writes).not.toHaveBeenCalled();
  });
  it("fails closed on read failure without quotes, RPC or writes", async () => {
    const mock = setup(true);
    await expect(loadPaperBuyState(mock.client, "session-owner", "order-0001")).rejects.toThrow("configuração");
    expect(mock.writes).not.toHaveBeenCalled();
  });
});