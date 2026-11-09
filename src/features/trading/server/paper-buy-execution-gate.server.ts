import type { PreparedPaperBuy } from "./paper-buy-boundary.server";

/**
 * Execution remains explicitly disabled until migration 0002 is deployed and
 * independently verified against the actual Lovable Cloud schema.
 * No RPC is performed and no service-role client is constructed here.
 */
export interface PaperBuyExecutionReceipt {
  readonly status: "execution_disabled";
  readonly executed: false;
  readonly reason: string;
}

export function executePreparedPaperBuy(
  _prepared: PreparedPaperBuy,
): PaperBuyExecutionReceipt {
  return {
    status: "execution_disabled",
    executed: false,
    reason: "Execução bloqueada até validação e implantação da migration 0002",
  };
}
