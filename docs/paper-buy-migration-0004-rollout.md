# Migration 0004 — Atomic Paper minimum notional (NOT deployed)

## Scope

Migration `drizzle/migrations/0004_paper_buy_min_notional.sql` replaces **only** the already existing `public.execute_paper_buy(uuid,text,text,text,numeric,numeric,numeric,numeric,timestamptz)` function in a transaction. It preserves the existing 0002 role guard, owner account lock, risk checks, stop-loss, idempotency, ledger writes, and privilege revocations, and adds the following rule *before* any debit or insert:

```sql
v_notional := p_quantity * p_entry_price;
IF v_notional < 5 THEN
  RAISE EXCEPTION 'Paper buy notional below 5 USDT';
END IF;
```

The 5 USDT amount is **an internal simulator test policy**, not a Kraken/Binance minimum market lot or exchange order filter. No exchange order is sent.

## Verified facts at authoring

- Read-only introspection of the real Lovable Cloud database (2026-11-09) showed `execute_paper_buy` installed with the exact expected 0002 argument signature and security-definer body, and no built-in 5 USDT guard yet.
- The screenshot showed that authenticated preparation-only checks passed. **No paper order was executed by that validation.**
- The app's UI and server preflight already implement the 5 USDT policy. This SQL brings the independently enforceable execution boundary into parity.

## Approval gate — required before any real-database migration

This GitHub PR authorizes only code and disposable-CI tests. **Do not deploy 0004 to the real database without explicit, separate operator approval.**

1. Obtain and independently verify a restorable backup and rollback procedure for the specific Lovable Cloud database.
2. Repeat read-only schema introspection and verify the installed function is still the expected 0002 body, signature, grants, `SECURITY DEFINER`, and `search_path` with no intervening changes.
3. Verify no other pending migrations, triggers, RLS policies, or proprietary modifications require merging.
4. Rehearse 0004 against an isolated, production-schema-compatible staging clone, not only GitHub's simplified fixture.
5. Perform read-only counts and cash snapshot; obtain operator authorization.
6. Apply 0004 atomically. Verify function privilege isolation, minimum guard, and unchanged cash/orders/positions/audit counts. Do **not** call the function in production as a smoke test.
7. Leave the **UI and both server-side order execution gates disabled**. A future feature activation is a separate reviewed decision.

## CI coverage

The disposable PostgreSQL integration workflow now applies 0002, upgrades to 0004, and runs `tests/postgres/paper-buy-min-notional.sql`, including:

- Rejection of a 0.0075 USDT order and a 4.9999 USDT order.
- No change to account cash, positions, orders or paper-buy audit records for either rejection.
- Exactly 5 USDT succeeds under other valid risk constraints **inside a savepoint-like exception block**; the test rolls back the permitted buy before checking that the ledger is pristine.
- Existing role/ownership, numeric, risk, rollback, idempotency and concurrency checks still pass after upgrade.

## Abort criteria

Any function definition drift, privileges mismatch, unverified backup, SQL error, unexpected database state, or real/paper execution switch unexpectedly enabled. Do not assume passing CI alone demonstrates safe production deployment.
