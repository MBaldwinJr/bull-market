import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { confirmedPaperBuySchema } from "./paper-buy-confirmation-schema";
import type { Database } from "@/integrations/supabase/types";

/**
 * Authenticated paper-only execution endpoint. Deliberately disabled at the
 * route level until a separately approved activation change. No UI calls it.
 */
export const submitControlledPaperBuy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => confirmedPaperBuySchema.parse(input))
  .handler(async ({ data, context }) => {
    if (process.env["PAPER_TRADING_ROUTE_ENABLED"] !== "true") {
      return { status: "execution_disabled" as const, executed: false as const };
    }
    const { prepareAuthenticatedPaperBuy } = await import("../server/paper-buy-boundary.server");
    const { loadPaperBuyState } = await import("../server/paper-buy-repository.server");
    const { fetchTrustedPaperQuote } = await import("../server/trusted-paper-quote");
    const { executePaperBuyWithApproval } = await import("../server/paper-buy-controlled-executor.server");

    const url = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceKey) throw new Error("Credenciais de servidor indisponíveis");
    const prepared = await prepareAuthenticatedPaperBuy({ clientOrderId: data.clientOrderId, symbol: data.symbol, strategyKey: data.strategyKey, quantity: data.quantity, stopPrice: data.stopPrice }, {
      verifiedUserId: async () => {
        const { data: result, error } = await context.supabase.auth.getUser();
        if (error || !result.user || result.user.id !== context.userId) throw new Error("Sessão inválida");
        return result.user.id;
      },
      serviceCredentialsAvailable: () => true,
      loadState: (ownerId, clientOrderId) => loadPaperBuyState(context.supabase, ownerId, clientOrderId),
      quote: fetchTrustedPaperQuote,
      now: Date.now,
    });

    // Service credential exists only on the server. Database RPC repeats all
    // ownership, freshness and risk checks atomically under the account lock.
    const serviceClient = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return executePaperBuyWithApproval(prepared, {
      enabled: process.env["PAPER_TRADING_ROUTE_ENABLED"] === "true",
      rpc: async (_name, args) => {
        const result = await serviceClient.rpc("execute_paper_buy", args);
        return { data: result.data as string | null, error: result.error };
      },
    });
  });
