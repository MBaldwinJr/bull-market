/**
 * Manual order activation is intentionally locked independently from the
 * server-side flags. A later reviewed release must change this constant and
 * pass integration checks before the UI can submit any order.
 */
export const MANUAL_PAPER_ORDER_UI_ENABLED = false as boolean;

export function canSubmitManualPaperOrder(input: {
  symbol: string;
  quantity: string;
  stopPrice: string;
  confirmation: string;
  strategyKey: string;
}): boolean {
  return MANUAL_PAPER_ORDER_UI_ENABLED &&
    /^[A-Z0-9]{2,20}$/.test(input.symbol) &&
    /^[a-z_]{2,128}$/.test(input.strategyKey) &&
    input.quantity.trim().length > 0 &&
    input.stopPrice.trim().length > 0 &&
    Number.isFinite(Number(input.quantity)) && Number(input.quantity) > 0 &&
    Number.isFinite(Number(input.stopPrice)) && Number(input.stopPrice) > 0 &&
    input.confirmation === "CONFIRMAR COMPRA SIMULADA";
}
