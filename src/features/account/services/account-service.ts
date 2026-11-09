import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { RiskLimitsInput } from "../schemas";
import { assertPersistedRiskLimits } from "../utils/risk-persistence";
import { canSetPaperAssetPermission } from "../utils/paper-asset-permission";

type Tables = Database["public"]["Tables"];
export type BotConfig = Tables["bot_config"]["Row"];
export type RiskLimits = Tables["risk_limits"]["Row"];
export type Asset = Tables["assets"]["Row"];
export type PaperAccount = Tables["paper_accounts"]["Row"];
export type PaperPosition = Tables["paper_positions"]["Row"];
export type PaperOrder = Tables["paper_orders"]["Row"];
export type Snapshot = Tables["portfolio_snapshots"]["Row"];
export type RiskEvent = Tables["risk_events"]["Row"];
export type AuditLog = Tables["audit_logs"]["Row"];
export type Strategy = Tables["trading_strategies"]["Row"];

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null || res.data === undefined) throw new Error("Registro não encontrado");
  return res.data as T;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada");
  return data.user.id;
}

export const accountService = {
  getBotConfig: async (): Promise<BotConfig> => unwrap<BotConfig>(await supabase.from("bot_config").select("*").maybeSingle()),
  getRiskLimits: async (): Promise<RiskLimits> => unwrap<RiskLimits>(await supabase.from("risk_limits").select("*").maybeSingle()),
  getPaperAccount: async (): Promise<PaperAccount> => unwrap<PaperAccount>(await supabase.from("paper_accounts").select("*").maybeSingle()),
  listAssets: async (): Promise<Asset[]> =>
    unwrap<Asset[]>(await supabase.from("assets").select("*").is("deleted_at", null).order("created_at")),
  listPositions: async (): Promise<PaperPosition[]> =>
    unwrap<PaperPosition[]>(await supabase.from("paper_positions").select("*").order("opened_at", { ascending: false }).limit(500)),
  listOrders: async (): Promise<PaperOrder[]> =>
    unwrap<PaperOrder[]>(await supabase.from("paper_orders").select("*").order("created_at", { ascending: false }).limit(500)),
  listSnapshots: async (): Promise<Snapshot[]> =>
    unwrap<Snapshot[]>(await supabase.from("portfolio_snapshots").select("*").order("captured_at").limit(1000)),
  listRiskEvents: async (): Promise<RiskEvent[]> =>
    unwrap<RiskEvent[]>(await supabase.from("risk_events").select("*").order("created_at", { ascending: false }).limit(200)),
  listAuditLogs: async (): Promise<AuditLog[]> =>
    unwrap<AuditLog[]>(await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)),
  listStrategies: async (): Promise<Strategy[]> =>
    unwrap<Strategy[]>(await supabase.from("trading_strategies").select("*").order("name")),

  updateRiskLimits: async (id: string, input: RiskLimitsInput) => {
    const ownerId = await currentUserId();
    const updated = unwrap<RiskLimits>(await supabase.from("risk_limits")
      .update(input).eq("id", id).eq("owner_id", ownerId).select().single());
    assertPersistedRiskLimits(updated, { id, ownerId, input });
    // A separate read confirms the durable state rather than just UPDATE's reply.
    const persisted = unwrap<RiskLimits>(await supabase.from("risk_limits")
      .select("*").eq("id", id).eq("owner_id", ownerId).single());
    assertPersistedRiskLimits(persisted, { id, ownerId, input });
  },

  setBotStatus: async (id: string, status: BotConfig["status"]) => {
    unwrap(await supabase.from("bot_config").update({ status }).eq("id", id).select().single());
  },

  // The database trigger mirrors the opening balance into cash_balance before
  // the first simulated trade. The client must never write operational cash.
  setPaperBalance: async (account: PaperAccount, initial: number) => {
    const updated = unwrap<PaperAccount>(
      await supabase
        .from("paper_accounts")
        .update({ initial_balance: initial })
        .eq("id", account.id)
        .select()
        .single(),
    );
    // The opening-balance trigger must mirror the new amount into operational
    // cash before the first trade. A successful UPDATE alone is not sufficient.
    if (Number(updated.initial_balance) !== initial) {
      throw new Error("O saldo inicial não foi confirmado pelo banco. Verifique a conta antes de operar.");
    }
    const { count, error: ordersError } = await supabase
      .from("paper_orders")
      .select("id", { count: "exact", head: true })
      .eq("account_id", account.id);
    if (ordersError) throw new Error("Não foi possível verificar as operações da conta: " + ordersError.message);
    if (count === 0 && Number(updated.cash_balance) !== initial) {
      throw new Error(
        "Saldo inicial registrado, mas saldo disponível não atualizado. A integridade do banco precisa ser corrigida antes de operar.",
      );
    }
  },

  addAsset: async (symbol: string, base: string, quote: string) => {
    const owner_id = await currentUserId();
    unwrap(
      await supabase
        .from("assets")
        .upsert({ owner_id, symbol, base_asset: base, quote_asset: quote, deleted_at: null }, { onConflict: "owner_id,symbol" })
        .select()
        .single(),
    );
  },

  setAssetPaperPermission: async (asset: Asset, enabled: boolean) => {
    // No trading endpoint, no exchange key, and no automatic bot activation.
    if (!canSetPaperAssetPermission(asset, enabled)) {
      throw new Error("Permissão disponível apenas para BTC/USDT e ETH/USDT ativos.");
    }
    const ownerId = await currentUserId();
    if (asset.owner_id !== ownerId) throw new Error("Ativo fora da conta autenticada");
    const saved = unwrap<Asset>(await supabase.from("assets")
      .update({ auto_trade_enabled: enabled })
      .eq("id", asset.id).eq("owner_id", ownerId)
      .eq("status", "active").is("deleted_at", null)
      .select("*").single());
    if (saved.owner_id !== ownerId || saved.id !== asset.id ||
        saved.auto_trade_enabled !== enabled) {
      throw new Error("O banco não confirmou a alteração da permissão.");
    }
    const verified = unwrap<Asset>(await supabase.from("assets")
      .select("*").eq("id", asset.id).eq("owner_id", ownerId).single());
    if (verified.auto_trade_enabled !== enabled) {
      throw new Error("A permissão não foi confirmada em nova leitura.");
    }
  },

  removeAsset: async (asset: Asset) => {
    unwrap(
      await supabase.from("assets").update({ deleted_at: new Date().toISOString() }).eq("id", asset.id).select().single(),
    );
  },

  updateStrategy: async (id: string, patch: { enabled?: boolean; weight?: number }) => {
    unwrap(await supabase.from("trading_strategies").update(patch).eq("id", id).select().single());
  },
};
