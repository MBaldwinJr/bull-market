# Simulated order minimum — activation safety check

The Bull Market application now rejects read-only simulated-buy preparations whose nominal value `quantity × trusted price` is less than **5 USDT**. This is an **internal simulator policy**, not a statement of Kraken/Binance trading filters, minimum notionals, or lot sizes.

The UI and authenticated server preparation flow use the same constant in `src/features/trading/utils/paper-order-policy.ts`.

## Critical production gap before enabling actual paper order execution
The **already installed** `public.execute_paper_buy` database function (migration `0002`) has its own atomic risk, cash and ownership checks, but it **does not currently enforce the new minimum notional**. An internal, privileged caller could bypass the preparation step if the execution gate were activated incorrectly.

Before enabling **any** real database paper-order writes:
1. Design a separately reviewed follow-up SQL migration enforcing `v_notional >= 5` in the atomic database function, before any account debit or inserted position.
2. Test the follow-up against a disposable PostgreSQL fixture and a production-schema staging clone, including a `0.0000001 BTC` rejection case with unchanged balances/orders/audits.
3. Verify real-database backups and obtain separate explicit authorization for the migration.
4. Keep both server execution gates and the manual UI submission switch disabled until this database parity check and the first controlled-order readiness process are complete.

This change has **not** modified the production database or authorized order execution.
