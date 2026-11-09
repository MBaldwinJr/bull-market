-- Recovery Lab / GitHub Actions candidate for historical migration 0003.
-- NOT DEPLOYED. NOT an active Drizzle migration.
-- Use only with a separately approved target after schema/ACL/backup review.
-- The function body below is copied exactly from
-- drizzle/migrations/0003_configuration_audit.sql.
-- Idempotence: matching installed objects are left untouched;
-- any existing divergent function/trigger or foreign hook aborts atomically.
-- No DROP, no CASCADE, no user data updates, no real/paper order execution.

BEGIN;
SET LOCAL lock_timeout = '5s';
DO $install$
DECLARE
  v_source CONSTANT text := $historical_source$
DECLARE
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_owner uuid;
  v_row_id uuid;
  v_fields jsonb;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN
    ('risk_limits', 'bot_config', 'paper_accounts', 'assets', 'trading_strategies')
    OR TG_OP NOT IN ('INSERT', 'UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'Unsupported configuration audit target';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_owner := OLD.owner_id;
    v_row_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_owner := NEW.owner_id;
    v_row_id := NEW.id;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_owner := NEW.owner_id;
    v_row_id := NEW.id;
    -- An internal order debit updates the account, but is NOT a
    -- configuration edit. The trade itself has a separate audit record.
    -- PL/pgSQL must not dereference table-specific fields in an AND
    -- expression on other tables, because boolean short-circuit is not guaranteed.
    IF TG_TABLE_NAME = 'paper_accounts' THEN
      IF NEW.initial_balance IS NOT DISTINCT FROM OLD.initial_balance THEN
        RETURN NEW;
      END IF;
    END IF;
    IF v_new - 'updated_at' - 'created_at' =
       v_old - 'updated_at' - 'created_at' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(keys.field ORDER BY keys.field), '[]'::jsonb)
  INTO v_fields
  FROM jsonb_object_keys(v_old || v_new) AS keys(field)
  WHERE keys.field NOT IN ('created_at', 'updated_at')
    AND (v_old -> keys.field) IS DISTINCT FROM (v_new -> keys.field);

  INSERT INTO public.audit_logs (owner_id, action, entity, details, status, source)
  VALUES (
    v_owner, 'configuration_' || lower(TG_OP), TG_TABLE_NAME,
    jsonb_build_object('row_id', v_row_id, 'changed_fields', v_fields),
    'success', 'db_trigger'
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$historical_source$;
  v_tables CONSTANT text[] := ARRAY['risk_limits','bot_config','paper_accounts','assets','trading_strategies'];
  v_names CONSTANT text[] := ARRAY['trg_audit_risk_limits','trg_audit_bot_config','trg_audit_paper_account','trg_audit_assets','trg_audit_strategies'];
  v_function oid;
  v_proc pg_proc%ROWTYPE;
  v_trg pg_trigger%ROWTYPE;
  v_i integer;
  v_created_function boolean := false;
  v_created_triggers integer := 0;
BEGIN
  -- If a homonymous overload exists, refuse it rather than accepting an
  -- ambiguous or spoofed audit function.
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND p.proname='audit_configuration_change'
      AND p.pronargs<>0
  ) THEN
    RAISE EXCEPTION 'Migration 0003: unexpected audit function overload';
  END IF;

  SELECT p.oid INTO v_function
  FROM pg_proc p
  WHERE p.pronamespace='public'::regnamespace
    AND p.proname='audit_configuration_change'
    AND p.pronargs=0;

  IF v_function IS NULL THEN
    -- No CREATE OR REPLACE: never replace code on a running system.
    EXECUTE format(
      'CREATE FUNCTION public.audit_configuration_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS %L',
      v_source
    );
    REVOKE ALL ON FUNCTION public.audit_configuration_change()
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.audit_configuration_change()
      TO service_role;
    v_created_function := true;
    SELECT oid INTO STRICT v_function
    FROM pg_proc WHERE oid='public.audit_configuration_change()'::regprocedure;
  END IF;

  SELECT * INTO STRICT v_proc FROM pg_proc WHERE oid=v_function;
  IF v_proc.prosrc IS DISTINCT FROM v_source
    OR v_proc.prokind <> 'f'
    OR v_proc.pronargs <> 0
    OR v_proc.prorettype <> 'pg_catalog.trigger'::regtype
    OR v_proc.prolang <> (SELECT oid FROM pg_language WHERE lanname='plpgsql')
    OR NOT v_proc.prosecdef
    OR v_proc.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']::text[]
  THEN
    RAISE EXCEPTION 'Migration 0003: function signature, source, search_path or security mismatch';
  END IF;

  IF has_function_privilege('anon',v_function,'EXECUTE')
    OR has_function_privilege('authenticated',v_function,'EXECUTE')
    OR NOT has_function_privilege('service_role',v_function,'EXECUTE')
    OR EXISTS (
      SELECT 1
      FROM aclexplode(v_proc.proacl) AS a
      WHERE a.privilege_type = 'EXECUTE'
        AND (a.grantee=0 OR a.grantee NOT IN (v_proc.proowner,'service_role'::regrole::oid))
    )
  THEN
    RAISE EXCEPTION 'Migration 0003: function EXECUTE privilege divergence';
  END IF;

  -- Refuse extra triggers that point at the same audit function, including
  -- a trigger attached to an unexpected table.
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgfoid=v_function AND NOT t.tgisinternal
      AND NOT EXISTS (
        SELECT 1
        FROM generate_subscripts(v_tables,1) i
        WHERE t.tgrelid=format('public.%I',v_tables[i])::regclass
          AND t.tgname=v_names[i]
      )
  ) THEN
    RAISE EXCEPTION 'Migration 0003: unexpected extra trigger invokes audit function';
  END IF;

  FOR v_i IN 1..array_length(v_tables,1) LOOP
    SELECT * INTO v_trg
    FROM pg_trigger t
    WHERE t.tgrelid=format('public.%I',v_tables[v_i])::regclass
      AND t.tgname=v_names[v_i];

    IF FOUND THEN
      -- 29 = ROW(1) + INSERT(4) + DELETE(8) + UPDATE(16), AFTER trigger.
      IF v_trg.tgisinternal OR v_trg.tgfoid<>v_function
        OR v_trg.tgtype::int<>29
        OR v_trg.tgenabled<>'O'
        OR v_trg.tgqual IS NOT NULL
        OR v_trg.tgattr::text <> ''
        OR v_trg.tgnargs<>0
        OR v_trg.tgconstraint<>0
      THEN
        RAISE EXCEPTION 'Migration 0003: trigger divergence at %.%',
          v_tables[v_i],v_names[v_i];
      END IF;
    ELSE
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change()',
        v_names[v_i],v_tables[v_i]
      );
      v_created_triggers := v_created_triggers+1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration 0003 candidate: function created=%, triggers created=%',
    v_created_function,v_created_triggers;
END
$install$;
COMMIT;
