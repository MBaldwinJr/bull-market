import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { paperBuyRequestSchema } from "./paper-buy-schema";

/** Preparation only: no UI caller, no admin import, no RPC or database mutation. */
export const preparePaperBuy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => paperBuyRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { prepareAuthenticatedPaperBuy } = await import("../server/paper-buy-boundary.server");
    const { loadPaperBuyState } = await import("../server/paper-buy-repository.server");
    const { fetchTrustedPaperQuote } = await import("../server/trusted-paper-quote");
    const prepared = await prepareAuthenticatedPaperBuy(data, {
      verifiedUserId: async () => {
        const result = await context.supabase.auth.getUser();
        if (result.error || !result.data.user || result.data.user.id !== context.userId) throw new Error("Sessão inválida");
        return result.data.user.id;
      },
      serviceCredentialsAvailable: () => Boolean(process.env['SUPABASE_URL'] && process.env['SUPABASE_SERVICE_ROLE_KEY']),
      loadState: (ownerId, clientOrderId) => loadPaperBuyState(context.supabase, ownerId, clientOrderId),
      quote: fetchTrustedPaperQuote,
      now: Date.now,
    });
    // RPC arguments remain server-side. This receipt is NOT an execution capability.
    return { status: "prepared_only" as const, executed: false as const,
      symbol: prepared.args.p_symbol, quantity: prepared.args.p_quantity,
      entryPrice: prepared.args.p_entry_price, fee: prepared.fee, totalDebit: prepared.totalDebit };
  });