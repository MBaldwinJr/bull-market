import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PaperPosition } from "@/features/account/services/account-service";
import type { PaperBuyState } from "./paper-buy-boundary.server";

/** Explicit owner filters supplement RLS. Never use the service-role client for reads. */
export async function loadPaperBuyState(
  client: SupabaseClient<Database>, ownerId: string, clientOrderId: string,
): Promise<PaperBuyState> {
  const [bot, limits, account, assets, strategies, orders] = await Promise.all([
    client.from("bot_config").select("*").eq("owner_id", ownerId).single(),
    client.from("risk_limits").select("*").eq("owner_id", ownerId).single(),
    client.from("paper_accounts").select("*").eq("owner_id", ownerId).single(),
    client.from("assets").select("*").eq("owner_id", ownerId),
    client.from("trading_strategies").select("*").eq("owner_id", ownerId),
    client.from("paper_orders").select("id").eq("owner_id", ownerId).eq("client_order_id", clientOrderId).limit(1),
  ]);
  if ([bot, limits, account, assets, strategies, orders].some((result) => result.error) ||
      !bot.data || !limits.data || !account.data || !assets.data || !strategies.data || !orders.data) {
    throw new Error("Não foi possível verificar a configuração da conta");
  }
  const positions: PaperPosition[] = [];
  // Keyset pagination avoids silently undercounting risk at the API row limit.
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    let query = client.from("paper_positions").select("*").eq("owner_id", ownerId)
      .eq("account_id", account.data.id).order("id").limit(500);
    if (cursor) query = query.gt("id", cursor);
    const result = await query;
    if (result.error || !result.data) throw new Error("Não foi possível verificar as posições");
    positions.push(...result.data);
    if (result.data.length === 0) return {
      bot: bot.data, limits: limits.data, account: account.data,
      assets: assets.data, strategies: strategies.data, positions,
      duplicateOrder: orders.data.length > 0,
    };
    cursor = result.data.at(-1)?.id;
  }
  throw new Error("Histórico excede o limite seguro de verificação");
}