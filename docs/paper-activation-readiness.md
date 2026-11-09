# Bull Market — Paper Trading release readiness

Status: **execution disabled**. This document is a test/approval record, not authorization to enable trading or deploy a change.

## Verified on GitHub
- PR #75 merged into `main` (commit `7dbfc9f4187a9f44b2ae3dac297ab707ff680a5a`).
- The disposable local Supabase Auth workflow successfully created two genuine Auth users and checked automatic bootstrap (16 records per user), real JWT RLS owner isolation, anonymous denial, and rejection of cross-user writes.
- Existing CI and PostgreSQL paper-trading integration suites passed.
- No real exchange order or withdrawal was sent by these CI workflows.

## Current application barriers
1. Manual order UI flag `MANUAL_PAPER_ORDER_UI_ENABLED` is `false`.
2. Default server gate `executePreparedPaperBuy` always returns `execution_disabled`.
3. Preparation endpoint `preparePaperBuy` returns `prepared_only` with `executed:false`; it does not submit an order.
4. The separate controlled executor requires `dependencies.enabled` **and** `PAPER_TRADING_EXECUTION_ENABLED=true`. Keep both off. Tests simulating this setting do not configure a deployed server.

The new `Paper Execution Default-Off Guard` workflow checks these source invariants on pull requests and pushes. A separate reviewed and authorized activation release would need its own security assessment; do not weaken the guard to pass a build.

## Not yet verified
- Independent successful restoration of an actual staging backup, with data and schema integrity.
- End-to-end Auth→UI→server→staging-DB signed-session smoke test in a deployed environment, distinct from disposable GitHub Actions.
- Live deployed server environment variables and any deployed deployment hooks.
- Controlled persistent paper order through a fully verified staging endpoint.
- A separately authorized operator safety plan (rollback, monitoring, circuit breaker, budget and limits).

## Required before considering a separate activation change
- Verify specific deployment identity, environment variables, secrets and permissions without exposing credentials.
- Restore a backup to a separate disposable environment and independently compare data integrity and structural parity.
- Recheck auth isolation, quote freshness, risk, idempotency and the migration 0004 5 USDT minimum on that environment.
- Verify all critical workflows are green and require explicit review for any PR that changes an execution gate.
- Keep real exchange trading and withdrawals disabled; any real-money activation requires its own distinct approval.

This file does not authorize production writes or deploy any migration.
