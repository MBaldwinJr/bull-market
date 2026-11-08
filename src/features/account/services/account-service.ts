import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { RiskLimitsInput } from "../schemas";

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

export async function audit(action: string, entity: string, details: Record<string, Json> = {}): Promise<void> {
  const owner_id = await currentUserId();
  await supabase.from("audit_logs").insert({ owner_id, action, entity, details });
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
  listStrategies: async (): Promise<Strategy[]> => unwrap<Strategy[]>(await supabase.from("trading_strategies").select("*").order("name")),

  updateRiskLimits: async (id: string, input: RiskLimitsInput) => {
    unwrap(await supabase.from("risk_limits").update(input).eq("id", id).select().single());
    await audit("risk.update", "risk_limits", { ...input });
  },

  setBotStatus: async (id: string, status: BotConfig["status"]) => {
    unwrap(await supabase.from("bot_config").update({ status }).eq("id", id).select().single());
    await audit(`bot.${status}`, "bot_config");
    if (status === "emergency_stopped") {
      const owner_id = await currentUserId();
      await supabase.from("risk_events").insert({
        owner_id,
        event_type: "emergency_stop",
        severity: "critical",
        message: "Parada de emergência acionada: novas entradas simuladas bloqueadas.",
      });
    }
  },

  setPaperBalance: async (account: PaperAccount, initial: number) => {
    unwrap(
      await supabase
        .from("paper_accounts")
        .update({ initial_balance: initial, cash_balance: initial })
        .eq("id", account.id)
        .select()
        .single(),
    );
    await audit("paper.balance.set", "paper_accounts", { initial_balance: initial });
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
    await audit("asset.add", "assets", { symbol });
  },

  removeAsset: async (asset: Asset) => {
    unwrap(
      await supabase.from("assets").update({ deleted_at: new Date().toISOString() }).eq("id", asset.id).select().single(),
    );
    await audit("asset.remove", "assets", { symbol: asset.symbol });
  },

  updateStrategy: async (id: string, patch: { enabled?: boolean; weight?: number }) => {
    unwrap(await supabase.from("trading_strategies").update(patch).eq("id", id).select().single());
    await audit("strategy.update", "trading_strategies", { id, ...patch });
  },
};
