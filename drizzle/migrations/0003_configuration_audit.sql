-- Migration 0003: atomic, server-owned configuration audit.
-- This migration ONLY installs triggers/functions. It does not place orders,
-- alter risk limits, change balances, or enable live trading.
-- Review against the actual database before any production deployment.

CREATE OR REPLACE FUNCTION public.audit_configuration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    IF TG_TABLE_NAME = 'paper_accounts'
       AND NEW.initial_balance IS NOT DISTINCT FROM OLD.initial_balance THEN
      RETURN NEW;
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
$$;

REVOKE ALL ON FUNCTION public.audit_configuration_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_configuration_change() TO service_role;

CREATE TRIGGER trg_audit_risk_limits
AFTER INSERT OR UPDATE OR DELETE ON public.risk_limits
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

CREATE TRIGGER trg_audit_bot_config
AFTER INSERT OR UPDATE OR DELETE ON public.bot_config
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

CREATE TRIGGER trg_audit_paper_account
AFTER INSERT OR UPDATE OR DELETE ON public.paper_accounts
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

CREATE TRIGGER trg_audit_assets
AFTER INSERT OR UPDATE OR DELETE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

CREATE TRIGGER trg_audit_strategies
AFTER INSERT OR UPDATE OR DELETE ON public.trading_strategies
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();
