/**
 * Recovery Lab build-time safety boundary.
 *
 * This is only for the standalone recovery-lab branch. Do NOT merge these
 * build defaults into the production main branch.
 *
 * There is intentionally no Supabase URL/key fallback. No real project is
 * inferred from a Lovable Cloud project ID, and the original staging or
 * production databases are NEVER accepted.
 */
export const RECOVERY_LAB_LOVABLE_ID = "9f4c5079-0871-47c3-92ef-aa1dd05738e5";
export const FORBIDDEN_SUPABASE_REFS = [
  "dsrjwmpvauipdssopydg", // production
  "yawdfupednxlicfogwxp", // homologation public fallback
] as const;

export type RecoveryEnv = Readonly<Record<string, string | undefined>>;

export function assertIsolatedRecoveryBuild(env: RecoveryEnv): void {
  const reject = (reason: string): never => {
    throw new Error(`Recovery Lab build denied: ${reason}`);
  };

  if (env["BULL_MARKET_DEPLOY_TARGET"] !== "recovery-lab")
    reject("dedicated deployment target not explicitly selected");
  if (env["VITE_BULL_MARKET_APP_ID"] !== RECOVERY_LAB_LOVABLE_ID)
    reject("Lovable app identity does not match Recovery Lab");

  if (env["PAPER_TRADING_ROUTE_ENABLED"] === "true" ||
      env["PAPER_TRADING_EXECUTION_ENABLED"] === "true" ||
      env["VITE_PAPER_STAGING_UI_ENABLED"] === "true")
    reject("trading execution or manual purchase UI enabled");

  const ref = env["VITE_SUPABASE_PROJECT_ID"];
  const approved = env["RECOVERY_LAB_APPROVED_PROJECT_REF"];
  if (!ref || !approved || ref !== approved || !/^[a-z0-9]{20}$/.test(ref))
    reject("verified, explicit Recovery Lab Supabase ref required");
  if ((FORBIDDEN_SUPABASE_REFS as readonly string[]).includes(ref))
    reject("production/homologation backend is forbidden");

  const url = env["VITE_SUPABASE_URL"];
  if (url !== `https://${ref}.supabase.co`)
    reject("public backend must match the unique Recovery Lab Supabase ref");

  const publicKey = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!publicKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey))
    reject("dedicated public publishable key required");

  // If the server has a Supabase endpoint configured at build time, it must
  // not silently reroute SSR requests to another database. Runtime must
  // independently preserve this invariant after deployment.
  if (env["SUPABASE_URL"] && env["SUPABASE_URL"] !== url)
    reject("server endpoint differs from the public Recovery Lab endpoint");
  if (env["SUPABASE_PUBLISHABLE_KEY"] &&
      env["SUPABASE_PUBLISHABLE_KEY"] !== publicKey)
    reject("server and browser publishable keys differ");
}
