# Recovery Lab: backend isolation — fail-closed release candidate

**Applies ONLY to the dedicated `recovery-lab` GitHub branch. Do not merge into `main` or `homologacao`.**

The Recovery Lab's Lovable Cloud project ID is `9f4c5079-0871-47c3-92ef-aa1dd05738e5`.
The homologation and production projects are separate Lovable apps:
- Homologation: `a37675cf-7419-49cd-87c3-74203b93f3e7`, public Supabase fallback `yawdfupednxlicfogwxp`.
- Production: `53ab617e-c9fb-449d-a719-311a513d4a02`, public Supabase fallback `dsrjwmpvauipdssopydg`.

## Verified observations (read-only, 2026-11-09)

Lovable's project-bound SQL tool showed the Recovery Lab with **zero Auth users and zero paper accounts**; homologation had **two Auth users and three paper accounts**. That demonstrates distinct data returned by the project-bound database tools, **not** proof that the browser previews use distinct databases.

The Recovery Lab and homologation both contained identical Supabase public URL and public key **fallbacks** in `vite.config.ts`. The frontend Supabase client selects `import.meta.env.VITE_SUPABASE_URL` first and otherwise may use server-side env values. The actual injected values in the hosted browser preview could not be independently inspected using the available tools. **Do not claim that browser isolation or remote deployment has been verified.**

The Recovery Lab is a Lovable remix, with no verified GitHub branch-to-project deployment linkage.

## Changes in this branch

- Delete the hardcoded production/homologation backend fallback from `vite.config.ts`.
- Execute `assertIsolatedRecoveryBuild(process.env)` before creating any Vite build.
- Refuse both known production and homologation Supabase refs, even if misconfigured as an approved destination.
- Refuse missing or mismatched IDs, HTTPS API URLs or public publishable keys.
- Refuse all order execution flags and the staging manual-order button.
- No `service_role`, API secret, exchange key or live trading token is put in browser code or GitHub Actions.
- CI uses a **synthetic unreachable 20-character ref and fake public key**, never production or staging. Its negative build deliberately points to homologation and MUST fail with an isolation error.

## Preconditions for a REAL Recovery Lab deployment

1. Obtain the **distinct backend Supabase project ref, URL and public publishable key** associated with the Recovery Lab. Confirm this is neither of the two refs above. Do not invent it.
2. Configure the **Recovery Lab deployment only** with:

```text
BULL_MARKET_DEPLOY_TARGET=recovery-lab
VITE_BULL_MARKET_APP_ID=9f4c5079-0871-47c3-92ef-aa1dd05738e5
RECOVERY_LAB_APPROVED_PROJECT_REF=<EXCLUSIVE_RECOVERY_REF>
VITE_SUPABASE_PROJECT_ID=<EXCLUSIVE_RECOVERY_REF>
VITE_SUPABASE_URL=https://<EXCLUSIVE_RECOVERY_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<RECOVERY_PUBLIC_PUBLISHABLE_KEY>
PAPER_TRADING_ROUTE_ENABLED=false
PAPER_TRADING_EXECUTION_ENABLED=false
VITE_PAPER_STAGING_UI_ENABLED=false
```

If `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is also defined for the build/server, it must refer to the **same** Recovery Lab backend. Service keys must remain server-side.

3. **Verify the deployment actually uses the dedicated `recovery-lab` branch** and does not inherit environment variables from production or staging. No such mapping is currently confirmed.
4. Inspect the browser application's effective API origin and token issuer without exposing secrets. Sign up one temporary Recovery user only after backup/restore tests and compare Auth user counts across **all three project-bound databases**; assert no contamination in production/homologation.
5. Test RLS, session isolation, recovery/restore from a real backup, and rollback before any remote trading activation.
6. The Recovery Lab remains a **diagnostic environment**. Do not turn on real trading, withdrawals, autonomous trading or even remote paper order execution here.

**Not deployed; no databases changed.**
