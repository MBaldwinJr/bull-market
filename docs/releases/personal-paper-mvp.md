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

## Lovable as the testing showcase (preview)
- Keep GitHub as the source of code changes and GitHub Actions for CI.
- Use the existing Lovable project preview to visually test login, dashboard, paper account, simulated operations, and responsive UI.
- Confirm the Lovable project is synced to the GitHub main branch after merging changes. A GitHub PR branch is not automatically the Lovable preview branch.
- Preview is not proof that the database migration was applied; verify the managed migration history separately.
- Do not use the Lovable AI chat/agent for edits unless explicitly requested; opening and testing preview should not require AI prompts.
- Keep preview private to the owner, with no public sign-up; never expose exchange API credentials or enable live orders/withdrawals.
- Record screenshots, browser errors and reproduction steps for failed tests, then fix in GitHub and retest in Lovable.

## Acceptance flow in Lovable
1. Open the existing project preview, verify it reflects the latest main commit.
2. Sign in using the owner account; verify other accounts cannot self-register.
3. Inspect dashboard and responsive navigation.
4. Set a paper opening balance before trading; verify it is persisted.
5. After the migration is confirmed, create a simulated order and inspect positions and history.
6. Confirm opening balance cannot be changed after the first paper trade and operational cash balance cannot be edited by the client.
7. Confirm risk-limit feedback and persistence after page reload.
8. Capture any failures as GitHub issues. Do not interpret UI-only demos as end-to-end execution.
