# Paper Trading: staging activation handoff

**Status: NOT DEPLOYED. No real database writes are authorized.**

The existing GitHub Actions integration suite runs migration 0002 against an **ephemeral PostgreSQL fixture**, not a clone of the real Lovable Cloud schema. Passing CI does not authorize activation.

## Required staging environment
- A separate, disposable staging project/database, **not** the current Lovable Cloud production database.
- A verified backup/restore procedure and a sanitized schema clone that preserves production constraints, RLS, triggers, and grants.
- Server-only staging credentials; never put the service-role key in frontend code or GitHub logs.
- Operator confirmation of the staging database identity before applying any migration.

## Read-only preflight
Run against **staging only**, using a read-only connection:

```bash
psql -v ON_ERROR_STOP=1 -f tests/postgres/paper-buy-staging-preflight.sql
```

This checks basic tables, columns, auth.role and service_role. It **does not** prove schema parity or verify backups. Compare full schema and triggers separately.

## Staging rehearsal (requires operator authorization)
1. Verify restore from the staging snapshot; compare all table DDL, constraints, policies, triggers and functions.
2. Run the preflight above and inspect the migration SQL and grants.
3. In the isolated staging database, apply `drizzle/migrations/0002_atomic_paper_buy.sql` once.
4. Confirm that only `service_role` can execute the function and that browser roles cannot.
5. Exercise one explicitly approved **staging-only** purchase, then verify cash, order, position and audit; test duplicate IDs, failed rollback, concurrency and stale quote.
6. Leave the application execution gate disabled until an independently reviewed, separate activation PR is approved.
7. Never enable exchange live orders, withdrawals, or use production credentials in staging.

## Blocking items
- No isolated staging database or verified production-schema clone has been identified.
- No independently verified restore test has been documented.
- Migration 0002 is not installed in the real database.
- The server execution gate always returns `execution_disabled`; this is intentional.
- A full UI-to-server-to-database smoke test is still pending.

**Do not deploy or remove the gate on the strength of CI fixture tests alone.**
