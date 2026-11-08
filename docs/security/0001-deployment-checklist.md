# Paper-trading migration 0001 — deployment checks

This document accompanies the pending 0001 migration. Do not manually insert a Drizzle history row or fabricate a snapshot.

## Before applying
1. Confirm the target is the Bull Market production Lovable Cloud database, and record `SHOW server_version_num;`.
2. Inspect `drizzle.__drizzle_migrations` and the current triggers/functions. Stop if 0001 is already recorded or any of its triggers exist.
3. Confirm the Lovable managed migration runner can reconcile the repository journal and absent 0001 snapshot. Do not use a local Drizzle runner against production.
4. Confirm the stored backup identifier and retention. A restore test is recommended even when the application has no users.
5. Review SQL and privileges with the actual PostgreSQL version. `MAINTAIN` exists only in PostgreSQL 17+ and is intentionally excluded from this version-agnostic SQL.
6. Test account creation, initial balance changes before/after a trade, cash balance write denial, order/position ownership, audit/risk writes, and concurrent first-trade versus balance update in an isolated PostgreSQL environment.
7. Verify the service-role trading engine can still write operational data and that live trading and withdrawals remain disabled.

## Read-only post-deployment verification
```sql
SELECT current_database(), current_user, current_setting('server_version_num') AS server_version_num;
SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY id;
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='paper_accounts' AND column_name='first_trade_at';
SELECT tgname, tgrelid::regclass AS table_name FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('trg_lock_paper_account_before_order','trg_lock_paper_account_before_position','trg_guard_paper_account_initial_balance');
SELECT has_table_privilege('authenticated', 'public.paper_accounts', 'TRUNCATE') AS account_truncate, has_table_privilege('authenticated','public.paper_orders','TRIGGER') AS order_trigger, has_table_privilege('authenticated','public.audit_logs','INSERT') AS audit_insert;
```

Do not declare the deployment successful until managed migration history, function/trigger presence, privileges, RLS and functional tests agree.