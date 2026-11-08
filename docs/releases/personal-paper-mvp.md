# Bull Market — personal paper-trading release

## Scope
Single owner, private access, simulated trading only. This is not a multi-tenant commercial release. Never place exchange secrets in browser code or GitHub.

## Release gates
- [x] Static migration assertions and repository CI passed on PR #6 (commit 8bd4007).
- [x] PR #6 merged to main (615a5f8).
- [ ] Verify latest main CI after merge.
- [ ] Confirm PostgreSQL server version and reconcile Drizzle migration journal/snapshot with the managed Lovable Cloud migration runner.
- [ ] Apply 0001 through the authorized managed migration mechanism; verify migration history and triggers.
- [ ] Verify authenticated users cannot change cash balances, write audit/risk rows, or bypass the first-trade opening-balance lock.
- [ ] Run concurrent balance-edit versus first-order test and owner/account integrity tests.
- [ ] Verify login, paper balance, order flow, positions, risk limits, dashboard and persistence end-to-end.
- [ ] Confirm live execution and withdrawals remain disabled.

## Personal-use acceptance
Only the owner's authorized account may enter the app. No public signup or invitation flow is required for this release. A single user does not remove the need for transaction safety, backups, credential protection or loss limits.

## Current status
Repository-level changes are merged. Production database migration and end-to-end acceptance are not verified. Do not describe this release as production-ready until all release gates pass.

## No Lovable AI credits
Use GitHub for code changes and GitHub Actions for CI. Lovable Cloud is the existing database; GitHub pushes do not apply its managed migrations.
