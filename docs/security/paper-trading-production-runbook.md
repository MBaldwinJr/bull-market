# Paper Trading Security — Production Runbook

## Status

Preparation only. This document and the companion migration are not authorization to
change the production database. Do not run the migration until the owner gives a
separate, explicit approval after reviewing the final SQL and backup evidence.

## Current evidence

- The Lovable Cloud database audit reported that only `0000_migration` is recorded.
- The audit reported that the functions and triggers from
  `0001_paper_account_integrity.sql` are absent.
- The Drizzle journal in Git contains entries for `0000_migration` and
  `0001_paper_account_integrity`.
- The expected `0001_snapshot.json` was not present in the repository when inspected.
- The Drizzle schema source is currently an intentionally blank generated file.
- Therefore, migration metadata is inconsistent and must be reconciled before any
  production migration command is selected.

## Required preflight — read only

1. Confirm the Lovable Cloud project and production database identity in the editor.
2. Export a recoverable backup and verify that it can be restored to an isolated
   environment. Record the backup identifier and timestamp.
3. Capture the complete current definitions of the affected tables, policies,
   grants, triggers, functions, extensions, and migration-history rows.
4. Confirm the actual migration runner used by this Lovable Cloud project. Do not
   assume that Drizzle Kit's local migration runner controls the managed database.
5. Reconcile the Drizzle journal and snapshots from the actual migration history.
   Do not create a fabricated snapshot or manually insert a migration-history row.
6. Apply the candidate SQL to a disposable database restored from the production
   backup, never to production during this preflight.

## Intended security behavior

- Authenticated users can read their own paper account, orders, positions, audit
  events, risk events, and portfolio snapshots, subject to existing RLS.
- Authenticated users can create an account with only `owner_id` and
  `quote_currency` supplied; database defaults establish balances.
- Authenticated users can update only `initial_balance`, and only before any
  order or position exists for that account.
- The database trigger synchronizes `cash_balance` with `initial_balance`
  during the allowed opening-balance edit.
- Orders, positions, audit logs, risk events, and portfolio snapshots are
  engine-owned writes. Authenticated clients receive no write privileges.
- Authenticated and anonymous roles receive no DELETE or TRUNCATE privileges on
  the protected paper-trading tables. The service role remains privileged for
  backend operations.
- Live trading and withdrawals remain disabled.

## Disposable-database test matrix

Run tests using separate authenticated sessions with representative JWT claims.
Use rollback transactions for non-concurrency checks. Concurrency checks require
two independent database sessions and must be recorded separately.

1. Account owner can read their own account; another owner cannot.
2. Owner can set the opening balance before any order or position exists.
3. Opening-balance update after an order is rejected.
4. Opening-balance update after a position is rejected.
5. Authenticated role cannot update `cash_balance` directly.
6. Authenticated role cannot insert, update, or delete orders and positions.
7. Authenticated role cannot insert, update, or delete audit and risk events.
8. Authenticated role cannot write portfolio snapshots.
9. Authenticated and anon roles cannot TRUNCATE any protected table.
10. A two-session race between the first trade insert and opening-balance update
    cannot allow both operations to succeed in an invalid order.
11. Service-role backend operations continue to work as intended.
12. Existing application flows for account creation, reading balances, and editing
    the opening balance before first activity continue to work.

## Important review notes

- The candidate migration is a one-time migration: its trigger creation statements
  are not intended to be blindly re-run.
- The migration runner and Drizzle metadata must be reconciled before application.
- The function security-definer ownership, fixed search_path, grants, and RLS
  interactions must be reviewed against the actual managed database.
- The migration does not authorize implementing a trading engine or enabling live
  trading.
- If any preflight check fails, stop and prepare a revised migration rather than
  improvising changes in production.

## Production change gate

A separate explicit owner approval is required after presenting:
- final migration SQL and reviewed diff;
- verified backup/restore evidence;
- disposable-database test results;
- exact production execution method and rollback/forward-recovery plan;
- expected lock duration and maintenance window;
- post-deployment verification queries.

No production DDL or data changes are authorized by this runbook.
