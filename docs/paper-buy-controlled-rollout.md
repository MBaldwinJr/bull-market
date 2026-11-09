# Paper buy migration 0002 — controlled rollout (NOT APPROVED)

## Current state
- Migration 0002 exists in GitHub but has **not** been applied to Lovable Cloud.
- The authenticated `preparePaperBuy` endpoint is **preparation only**.
- The server execution gate returns `execution_disabled` unconditionally.
- No paper order, position, cash debit, or audit record is authorized by this checklist.

## Preconditions (all required)
1. Obtain an independently restorable database backup and verify recovery procedure.
2. Confirm exact target project, database, migration history, function signature and table constraints.
3. Compare all NOT NULL columns, defaults, checks, FKs, triggers, RLS policies, and owner uniqueness with the production schema.
4. Confirm `auth.role()`, service-role permissions and a server-only service credential in the target runtime. Never expose the service key to browser code or logs.
5. Run a complete production-schema clone test in an isolated environment, including rollback, duplicate order ID, concurrent orders and rejected authenticated invocation.
6. Confirm explicit operator approval and maintenance/rollback window before any migration execution.

## Installation sequence (separate future change, not this PR)
1. Back up and inspect the target database; capture migration/version identifiers.
2. Apply migration 0002 to isolated staging clone first, inspect installed function and GRANT/REVOKE.
3. Run staging integration tests and confirm no external exchange order calls.
4. Apply to target only after operator approval; retain execution gate disabled.
5. Verify schema/function permissions read-only, then independently approve a separate feature-gated paper-only activation change.
6. First activation should be manual, one authenticated user, idempotent client ID, bounded quantity and explicit rollback/kill switch. Never enable live trading or withdrawals.

## Abort criteria
- Any mismatch in schema, RLS, grants, constraints or triggers.
- Any migration error, inconsistent cash/order/position/audit totals, unexpected RPC caller, or secret leakage.
- Any ambiguity about ownership or target environment.

## Rollback guidance
Do not casually drop the function after use: it may have written paper orders.
Keep execution gate disabled; restore from a verified backup only after reviewing all affected records.
