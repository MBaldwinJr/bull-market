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
    const { isHomologationPaperBuyEnabled, assertHomologationPaperOrder } =
      await import("../server/staging-paper-activation.server");
    if (!isHomologationPaperBuyEnabled(process.env)) {
      return { status: "execution_disabled" as const, executed: false as const };
    }
    const { prepareAuthenticatedPaperBuy } = await import("../server/paper-buy-boundary.server");
    const { loadPaperBuyState } = await import("../server/paper-buy-repository.server");
    const { fetchTrustedPaperQuote } = await import("../server/trusted-paper-quote");
    const { executePaperBuyWithApproval } = await import("../server/paper-buy-controlled-executor.server");

    const url = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceKey) throw new Error("Credenciais de servidor indisponíveis");
    let stageLimits: {
      initial_balance: number; max_risk_per_trade_pct: number;
      max_daily_loss_pct: number; max_open_positions: number;
    } | null = null;
    const prepared = await prepareAuthenticatedPaperBuy({ clientOrderId: data.clientOrderId, symbol: data.symbol, strategyKey: data.strategyKey, quantity: data.quantity, stopPrice: data.stopPrice }, {
      verifiedUserId: async () => {
        const { data: result, error } = await context.supabase.auth.getUser();
        if (error || !result.user || result.user.id !== context.userId) throw new Error("Sessão inválida");
        return result.user.id;
      },
      serviceCredentialsAvailable: () => true,
      loadState: async (ownerId, clientOrderId) => {
        const state = await loadPaperBuyState(context.supabase, ownerId, clientOrderId);
        stageLimits = {
          initial_balance: Number(state.account.initial_balance),
          max_risk_per_trade_pct: Number(state.limits.max_risk_per_trade_pct),
          max_daily_loss_pct: Number(state.limits.max_daily_loss_pct),
          max_open_positions: Number(state.limits.max_open_positions),
        };
        return state;
      },
      quote: fetchTrustedPaperQuote,
      now: Date.now,
    });

    if (stageLimits === null) throw new Error("Limites da homologação indisponíveis");
    assertHomologationPaperOrder(prepared, stageLimits);

    // Service credential exists only on the server. Database RPC repeats all
    // ownership, freshness and risk checks atomically under the account lock.
    const serviceClient = createClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return executePaperBuyWithApproval(prepared, {
      enabled: isHomologationPaperBuyEnabled(process.env),
      rpc: async (_name, args) => {
        const result = await serviceClient.rpc("execute_paper_buy", args);
        return { data: result.data as string | null, error: result.error };
      },
    });
  });
