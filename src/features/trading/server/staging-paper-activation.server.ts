/**
 * Opt-in gate for simulated BUY orders in the dedicated homologation app.
 * Fails closed on incomplete, ambiguous or production-facing configuration.
 * This authorizes no real exchange integration and never enables withdrawals.
 */
export const HOMOLOGATION_APP_ID = "a37675cf-7419-49cd-87c3-74203b93f3e7";
export const KNOWN_MAIN_SUPABASE_REF = "dsrjwmpvauipdssopydg";

export const STAGING_MAX_ORDER_NOTIONAL_USDT = 10;
export const STAGING_MAX_INITIAL_BALANCE_USDT = 100;
export const STAGING_MAX_RISK_PER_TRADE_PCT = 0.5;
export const STAGING_MAX_DAILY_LOSS_PCT = 1;

type Environment = Readonly<Record<string, string | undefined>>;

function cleanHttpsOrigin(value: string | undefined): string | null {
  if (!value || value.trim() !== value || value.endsWith("/")) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname ||
        parsed.username || parsed.password || parsed.port ||
        parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Both a dedicated app ID and an exact Supabase URL/ref must be configured.
 * No fallback to the public production URL is permitted.
 *
 * These settings must be provisioned ONLY on the isolated homologation
 * deployment. The GitHub main branch and existing deployments remain off.
 */
export function isHomologationPaperBuyEnabled(env: Environment): boolean {
  if (env["BULL_MARKET_ENVIRONMENT"] !== "homologacao" ||
      env["BULL_MARKET_APP_ID"] !== HOMOLOGATION_APP_ID ||
      env["PAPER_STAGING_APPROVED_APP_ID"] !== HOMOLOGATION_APP_ID ||
      env["PAPER_TRADING_ROUTE_ENABLED"] !== "true" ||
      env["PAPER_TRADING_EXECUTION_ENABLED"] !== "true") return false;

  const projectRef = env["PAPER_STAGING_APPROVED_PROJECT_REF"];
  if (!projectRef || !/^[a-z0-9]{8,32}$/.test(projectRef) ||
      projectRef === KNOWN_MAIN_SUPABASE_REF ||
      env["VITE_SUPABASE_PROJECT_ID"] !== projectRef) return false;

  const backend = cleanHttpsOrigin(env["SUPABASE_URL"]);
  const approved = cleanHttpsOrigin(env["PAPER_STAGING_APPROVED_SUPABASE_URL"]);
  const publicUrl = cleanHttpsOrigin(env["VITE_SUPABASE_URL"]);
  if (!backend || !approved || !publicUrl || backend !== approved || backend !== publicUrl) return false;

  const hostname = new URL(backend).hostname;
  if (hostname !== `${projectRef}.supabase.co` ||
      hostname === `${KNOWN_MAIN_SUPABASE_REF}.supabase.co`) return false;

  return true;
}

export function assertHomologationPaperOrder(
  prepared: { readonly args: { readonly p_quantity: number; readonly p_entry_price: number };
    readonly totalDebit: number },
  limits: { readonly initial_balance: number; readonly max_risk_per_trade_pct: number;
    readonly max_daily_loss_pct: number; readonly max_open_positions: number },
): void {
  const notional = prepared.args.p_quantity * prepared.args.p_entry_price;
  if (!Number.isFinite(notional) || notional < 5 ||
      notional > STAGING_MAX_ORDER_NOTIONAL_USDT ||
      !Number.isFinite(prepared.totalDebit) ||
      prepared.totalDebit > STAGING_MAX_ORDER_NOTIONAL_USDT * 1.01) {
    throw new Error("Limite de 10 USDT por compra simulada na homologação");
  }
  if (!Number.isFinite(limits.initial_balance) || limits.initial_balance <= 0 ||
      limits.initial_balance > STAGING_MAX_INITIAL_BALANCE_USDT ||
      !Number.isFinite(limits.max_risk_per_trade_pct) ||
      limits.max_risk_per_trade_pct <= 0 ||
      limits.max_risk_per_trade_pct > STAGING_MAX_RISK_PER_TRADE_PCT ||
      !Number.isFinite(limits.max_daily_loss_pct) ||
      limits.max_daily_loss_pct <= 0 ||
      limits.max_daily_loss_pct > STAGING_MAX_DAILY_LOSS_PCT ||
      !Number.isInteger(limits.max_open_positions) ||
      limits.max_open_positions !== 1) {
    throw new Error("Limites de risco da homologação fora dos parâmetros aprovados");
  }
}
