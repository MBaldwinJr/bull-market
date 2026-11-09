# Migration 0003 — configuration audit rollout

Status: **NOT DEPLOYED TO THE REAL DATABASE**. GitHub CI uses disposable PostgreSQL 16.
Deploy only after production schema checks, an independently restorable backup, and explicit operator authorization.

## Purpose
- Keep a server-owned audit record of INSERT/UPDATE/DELETE events on risk limits, bot settings, watched assets, strategies, and paper accounts.
- Log changed field **names**, not private values. Account operational cash debits are not misclassified as configuration changes.
- A failed audit write rolls the entire configuration transaction back.
- Users retain only SELECT permission for audit logs; triggers run as a privileged database function.
- Migration does not enable order execution, brokerage connections, leverage, live trading, or withdrawals.

## Before deployment (read-only)
1. Confirm the real PostgreSQL schema matches all five table names, each table has `id uuid` and `owner_id uuid`, and `public.audit_logs` accepts columns `owner_id, action, entity, details, status, source`.
2. Check whether `public.audit_configuration_change()` or any `trg_audit_*` trigger already exists; reconcile differences instead of replacing unreviewed logic.
3. Confirm restore capability, a recovery plan, and authorization.
4. Apply `drizzle/migrations/0003_configuration_audit.sql` atomically, including function privileges and all triggers.

## After deployment (read-only)
- Verify five audit triggers are enabled and attached to the intended tables.
- Verify `has_function_privilege('authenticated','public.audit_configuration_change()','EXECUTE')` is false.
- Verify no trading flags changed and no orders or positions were created during deployment.
- In a planned follow-up, perform a user-authorized **configuration-only** edit and verify exactly one audit record. Do not use a paper order as an audit smoke test.

Before production deployment, the application must not describe automatic configuration auditing as an already verified guarantee.
