-- Must run only in a disposable PostgreSQL database after migration 0003.
DO $$
DECLARE v_oid oid;
BEGIN
  SELECT p.oid INTO STRICT v_oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'audit_configuration_change';
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'Audit trigger function must be security definer';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR has_function_privilege('public', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Audit trigger is publicly callable';
  END IF;
  IF has_table_privilege('authenticated', 'public.audit_logs', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated clients must not forge audit entries';
  END IF;
END $$;

SET ROLE authenticated;
UPDATE public.risk_limits SET max_risk_per_trade_pct = 0.4
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.risk_limits SET max_risk_per_trade_pct = 0.4
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.risk_limits SET updated_at = now() + interval '1 second'
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.bot_config SET status = 'running'
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.paper_accounts SET initial_balance = 120
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
INSERT INTO public.assets (owner_id, symbol) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ETHUSDT');
UPDATE public.assets SET auto_trade_enabled = true
 WHERE symbol = 'BTCUSDT' AND owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE public.trading_strategies SET enabled = true
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DELETE FROM public.trading_strategies
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
RESET ROLE;

-- Engine-owned operational cash debit is not a configuration change.
UPDATE public.paper_accounts SET cash_balance = 99
 WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.audit_logs WHERE action LIKE 'configuration_%') <> 7 THEN
    RAISE EXCEPTION 'Expected seven real configuration changes, excluding no-op updates and cash debit';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE action = 'configuration_update' AND entity = 'risk_limits'
      AND details->'changed_fields' = '["max_risk_per_trade_pct"]'::jsonb
      AND source = 'db_trigger' AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'Risk limit change not securely audited';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs WHERE entity='paper_accounts') <> 1 THEN
    RAISE EXCEPTION 'Balance adjustments wrongly logged as configuration changes';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs WHERE entity='trading_strategies') <> 2 THEN
    RAISE EXCEPTION 'Strategy update/deletion not audited';
  END IF;
END $$;

-- A failed audit write must abort the entire source configuration change.
BEGIN;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT reject_new_config_audit
  CHECK (action NOT LIKE 'configuration_%') NOT VALID;
DO $$
BEGIN
  BEGIN
    UPDATE public.risk_limits SET max_daily_loss_pct = 2
     WHERE owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'Audit insert was expected to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.risk_limits WHERE max_daily_loss_pct <> 1) THEN
    RAISE EXCEPTION 'Risk update survived a failed audit insert';
  END IF;
END $$;
ROLLBACK;
