# Bull Market — Migration 0003 candidate (Recovery Lab only)

**Status: NOT DEPLOYED.** This directory is NOT part of `drizzle/migrations/` and its SQL is never invoked by a cloud deployment or default migration runner.

The historical source of truth is `drizzle/migrations/0003_configuration_audit.sql`. The candidate in this directory copies the original PL/pgSQL body verbatim, but changes installation semantics: **no silent replacement** of a present function, no duplicate triggers, and all five trigger definitions and function privileges must match or the entire transaction aborts. Installing it is NOT a substitute for validating a backup restore.

The separate GitHub Actions job `PostgreSQL Audit Candidate (Disposable)` runs the SQL on a Docker PostgreSQL service, checks idempotence, explicit drift refusal, matching function bodies and trigger definitions with the historical 0003, and reuses the already passing signup test (15 configuration-insert logs, account isolation and full outer rollback). It also checks a partially installed configuration audit can be completed safely.

**Do not copy this candidate into an active Drizzle migration directory. Do not run the historical 0000 schema against an existing cloud database.**

Before ever applying to a persistent Lab database: verify the target project and fresh schema catalog, prove an independent backup restore, review service-role function ownership and privileges, explicitly approve the 15 signup-created audit events, and obtain a separate explicit authorization for the target database. Production and primary homologation are not deployment targets of this change.
