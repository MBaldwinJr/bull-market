import { fetchTrustedPaperQuote } from "./trusted-paper-quote";
import { planPaperBuy, type PaperExecutionPlan } from "../utils/paper-execution-plan";
import type { PaperEntryInput } from "../utils/paper-entry-risk";

/**
 * Trusted backend-only preflight. Do not export as a public createServerFn:
 * the caller must first authenticate the user, load owner-scoped account/risk
 * settings from the database and independently derive position/daily P&L.
 * Neither price nor timestamp may be supplied by a browser.
 */
export async function prepareTrustedPaperBuy(
  input: Omit<PaperEntryInput, "entryPrice" | "marketFresh"> & {
    symbol: string;
    feeRate: number;
  },
): Promise<{ plan: PaperExecutionPlan; quotedAt: string }> {
  const quote = await fetchTrustedPaperQuote(input.symbol);
  const plan = planPaperBuy({
    ...input,
    entryPrice: quote.price,
    marketFresh: Date.now() - Date.parse(quote.fetchedAt) <= 30_000,
  });
  return { plan, quotedAt: quote.fetchedAt };
}
