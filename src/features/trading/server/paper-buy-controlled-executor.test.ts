import { afterEach, describe, expect, it, vi } from "vitest";
import { executePaperBuyWithApproval } from "./paper-buy-controlled-executor.server";
import type { PreparedPaperBuy } from "./paper-buy-boundary.server";

const prepared = {
  rpc: "execute_paper_buy",
  args: {
    p_owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    p_client_order_id: "paper-order-0001",
    p_symbol: "BTCUSDT",
    p_strategy_key: "ema",
    p_quantity: 0.1,
    p_entry_price: 50,
    p_stop_loss: 49,
    p_fee_rate: 0.001,
    p_quote_at: "2026-11-08T12:00:00Z",
  },
  fee: 0.005,
  totalDebit: 5.005,
} satisfies PreparedPaperBuy;

const previousFlag = process.env["PAPER_TRADING_EXECUTION_ENABLED"];
afterEach(() => {
  if (previousFlag === undefined) delete process.env["PAPER_TRADING_EXECUTION_ENABLED"];
  else process.env["PAPER_TRADING_EXECUTION_ENABLED"] = previousFlag;
});

describe("controlled paper executor", () => {
  it("rejects without operator switch and never calls RPC", async () => {
    delete process.env["PAPER_TRADING_EXECUTION_ENABLED"];
    const rpc = vi.fn();
    const result = await executePaperBuyWithApproval(prepared, { enabled: true, rpc });
    expect(result).toMatchObject({ status: "execution_disabled", executed: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects when caller authorization is false even if env switch is on", async () => {
    process.env["PAPER_TRADING_EXECUTION_ENABLED"] = "true";
    const rpc = vi.fn();
    const result = await executePaperBuyWithApproval(prepared, { enabled: false, rpc });
    expect(result).toMatchObject({ status: "execution_disabled", executed: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls only paper RPC when both independent gates are on", async () => {
    process.env["PAPER_TRADING_EXECUTION_ENABLED"] = "true";
    const rpc = vi.fn().mockResolvedValue({ data: "11111111-1111-4111-8111-111111111111", error: null });
    const result = await executePaperBuyWithApproval(prepared, { enabled: true, rpc });
    expect(result).toEqual({ status: "executed", executed: true, orderId: "11111111-1111-4111-8111-111111111111" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("execute_paper_buy", prepared.args);
  });

  it("rejects invalid DB response", async () => {
    process.env["PAPER_TRADING_EXECUTION_ENABLED"] = "true";
    await expect(executePaperBuyWithApproval(prepared, {
      enabled: true, rpc: vi.fn().mockResolvedValue({ data: "invalid", error: null }),
    })).rejects.toThrow("Resposta inválida");
  });
});
