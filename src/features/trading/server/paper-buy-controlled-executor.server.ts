import type { PreparedPaperBuy } from "./paper-buy-boundary.server";

/**
 * Server-only execution adapter. It does not instantiate a privileged client,
 * and cannot execute unless an operator enables the explicit paper-only switch.
 * Callers must perform fresh authenticated preflight immediately before invocation.
 */
export interface PaperBuyRpc {
  (name: "execute_paper_buy", args: PreparedPaperBuy["args"]):
    Promise<{ data: string | null; error: { message: string } | null }>;
}

export type ControlledPaperBuyResult =
  | { readonly status: "execution_disabled"; readonly executed: false; readonly reason: string }
  | { readonly status: "executed"; readonly executed: true; readonly orderId: string };

export async function executePaperBuyWithApproval(
  prepared: PreparedPaperBuy,
  dependencies: {
    readonly enabled: boolean;
    readonly rpc: PaperBuyRpc;
  },
): Promise<ControlledPaperBuyResult> {
  if (!dependencies.enabled || process.env["PAPER_TRADING_EXECUTION_ENABLED"] !== "true") {
    return {
      status: "execution_disabled",
      executed: false,
      reason: "Paper Trading desabilitado no servidor",
    };
  }
  if (prepared.rpc !== "execute_paper_buy") throw new Error("Operação não autorizada");
  const { data, error } = await dependencies.rpc("execute_paper_buy", prepared.args);
  if (error) throw new Error("Falha na execução simulada: " + error.message);
  if (!data || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
    throw new Error("Resposta inválida da ordem simulada");
  }
  return { status: "executed", executed: true, orderId: data };
}
