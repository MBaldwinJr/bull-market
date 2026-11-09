#!/usr/bin/env bash
# GitHub Actions / PostgreSQL disposable service ONLY.
# No Supabase/Lovable connection, no trading orders and no persistent data.
set -euo pipefail

test "${GITHUB_ACTIONS:-}" = "true" || { echo "Refusing outside GitHub Actions"; exit 2; }
test "${PGHOST:-}" = "localhost" || { echo "Refusing nonlocal PGHOST"; exit 2; }
test "${PGDATABASE:-}" = "bull_market_candidate_ci" || { echo "Refusing unexpected database"; exit 2; }
test "${PGPORT:-}" = "5432" || { echo "Refusing unexpected PostgreSQL port"; exit 2; }
test "${PGUSER:-}" = "postgres" || { echo "Refusing unexpected PostgreSQL role"; exit 2; }

psql -v ON_ERROR_STOP=1 -Atc "SELECT current_database(),inet_server_addr(),inet_server_port()"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;"

CANDIDATE="db/lab-patches/0002_configuration_audit_candidate.sql"
HISTORICAL="drizzle/migrations/0003_configuration_audit.sql"
SIGNUP="tests/postgres/config-audit-signup-rollback.sql"

prepare() {
  local database="$1"
  echo "--- Preparing disposable database $database"
  psql -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $database;"
  # Roles are cluster-wide: use the Auth fixture without its CREATE ROLE lines.
  sed '/^CREATE ROLE /d' tests/postgres/config-audit-signup-fixture.sql | psql -d "$database" -X -v ON_ERROR_STOP=1 -q
  psql -d "$database" -X -v ON_ERROR_STOP=1 -q -f drizzle/migrations/0000_migration.sql
  psql -d "$database" -X -v ON_ERROR_STOP=1 -q -f drizzle/migrations/0001_paper_account_integrity.sql
}

apply() {
  psql -d "$1" -X -v ON_ERROR_STOP=1 -q -f "$2"
}

snapshot() {
  psql -d "$1" -X -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT md5(
  (SELECT p.oid::text||':'||p.xmin::text||':'||md5(p.prosrc)||':'||coalesce(p.proacl::text,'')
   FROM pg_proc p
   WHERE p.oid='public.audit_configuration_change()'::regprocedure)
  || '|'
  || (SELECT string_agg(t.oid::text||':'||t.xmin::text||':'||pg_get_triggerdef(t.oid)||':'||t.tgenabled,'|' ORDER BY t.tgname)
      FROM pg_trigger t
      WHERE t.tgname LIKE 'trg_audit_%' AND NOT t.tgisinternal)
);
SQL
}

assert_equal() {
  if [[ "$1" != "$2" ]]; then
    echo "FAIL: $3 (value before=$1; after=$2)" >&2
    exit 1
  fi
  echo "PASS: $3"
}

assert_audit_invariants() {
  local database="$1"
  local result
  result="$(psql -d "$database" -X -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'trg_audit_%' AND NOT tgisinternal AND tgenabled='O') = 5
  AND (SELECT count(*) FROM pg_policies WHERE schemaname='public') >= 18
  AND (SELECT count(*) FROM auth.users) = 0
  AND (SELECT count(*) FROM public.audit_logs) = 0
  AND (SELECT count(*) FROM public.paper_orders) = 0
  AND (SELECT count(*) FROM public.paper_positions) = 0
  AND NOT has_function_privilege('anon','public.audit_configuration_change()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.audit_configuration_change()','EXECUTE')
  AND has_function_privilege('service_role','public.audit_configuration_change()','EXECUTE');
SQL
)"
  assert_equal "$result" "t" "$database: triggers, RLS, ACL, zero records"
}

expect_divergence() {
  local tag="$1" database="$2"
  local file
  file="$(mktemp)"
  if apply "$database" "$CANDIDATE" >"$file" 2>&1; then
    cat "$file"
    rm -f "$file"
    echo "FAIL: $tag was unexpectedly accepted" >&2
    exit 1
  fi
  if ! grep -q 'Migration 0003:' "$file"; then
    cat "$file"
    rm -f "$file"
    echo "FAIL: $tag failed for an unrelated reason" >&2
    exit 1
  fi
  echo "PASS: safely rejected $tag"
  rm -f "$file"
}

prepare candidate_ci
apply candidate_ci "$CANDIDATE"
before="$(snapshot candidate_ci)"
apply candidate_ci "$CANDIDATE"
after="$(snapshot candidate_ci)"
assert_equal "$before" "$after" "second application changed no installed object"
assert_audit_invariants candidate_ci
apply candidate_ci "$SIGNUP"
assert_audit_invariants candidate_ci
before="$(snapshot candidate_ci)"
apply candidate_ci "$CANDIDATE"
after="$(snapshot candidate_ci)"
assert_equal "$before" "$after" "re-application after signup rollback is a no-op"

prepare historical_ci
apply historical_ci "$HISTORICAL"
before="$(snapshot historical_ci)"
apply historical_ci "$CANDIDATE"
after="$(snapshot historical_ci)"
assert_equal "$before" "$after" "candidate recognizes historical 0003 without changes"
assert_audit_invariants historical_ci
apply historical_ci "$SIGNUP"

candidate_source="$(psql -d candidate_ci -Atc "SELECT md5(prosrc) FROM pg_proc WHERE oid='public.audit_configuration_change()'::regprocedure;")"
historical_source="$(psql -d historical_ci -Atc "SELECT md5(prosrc) FROM pg_proc WHERE oid='public.audit_configuration_change()'::regprocedure;")"
assert_equal "$candidate_source" "$historical_source" "function body matches exact historical SQL"

candidate_triggers="$(psql -d candidate_ci -Atc "SELECT md5(string_agg(pg_get_triggerdef(oid),'|' ORDER BY tgname)) FROM pg_trigger WHERE tgname LIKE 'trg_audit_%';")"
historical_triggers="$(psql -d historical_ci -Atc "SELECT md5(string_agg(pg_get_triggerdef(oid),'|' ORDER BY tgname)) FROM pg_trigger WHERE tgname LIKE 'trg_audit_%';")"
assert_equal "$candidate_triggers" "$historical_triggers" "five trigger definitions match historical SQL"

prepare divergence_ci
apply divergence_ci "$CANDIDATE"

psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "ALTER FUNCTION public.audit_configuration_change() SECURITY INVOKER;"
before="$(snapshot divergence_ci)"
expect_divergence "unsafe SECURITY INVOKER function" divergence_ci
assert_equal "$before" "$(snapshot divergence_ci)" "function drift rejection made no other changes"
psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "ALTER FUNCTION public.audit_configuration_change() SECURITY DEFINER;"

psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "GRANT EXECUTE ON FUNCTION public.audit_configuration_change() TO authenticated;"
before="$(snapshot divergence_ci)"
expect_divergence "unexpected function EXECUTE grant" divergence_ci
assert_equal "$before" "$(snapshot divergence_ci)" "ACL drift rejection made no other changes"
psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "REVOKE EXECUTE ON FUNCTION public.audit_configuration_change() FROM authenticated;"

psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "ALTER TABLE public.assets DISABLE TRIGGER trg_audit_assets;"
before="$(snapshot divergence_ci)"
expect_divergence "disabled configuration trigger" divergence_ci
assert_equal "$before" "$(snapshot divergence_ci)" "trigger drift rejection made no other changes"
psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "ALTER TABLE public.assets ENABLE TRIGGER trg_audit_assets;"

psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "CREATE TRIGGER unexpected_duplicate_audit AFTER UPDATE ON public.risk_limits FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();"
before="$(snapshot divergence_ci)"
expect_divergence "additional unreviewed audit trigger" divergence_ci
assert_equal "$before" "$(snapshot divergence_ci)" "extra trigger rejection made no other changes"
psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "DROP TRIGGER unexpected_duplicate_audit ON public.risk_limits;"

psql -d divergence_ci -v ON_ERROR_STOP=1 -q -c "DROP TRIGGER trg_audit_strategies ON public.trading_strategies;"
apply divergence_ci "$CANDIDATE"
assert_audit_invariants divergence_ci
echo "PASS: safely completed partially installed audit trigger set"
echo "SUCCESS: all disposable configuration audit candidate tests passed"
