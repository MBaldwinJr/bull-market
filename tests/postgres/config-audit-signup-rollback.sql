-- Migration 0003 + signup trigger integration test.
-- ONLY run in a fresh disposable PostgreSQL database created by GitHub Actions.
-- Precondition: auth fixture, historical 0000, 0001 and 0003 applied in that order.
-- All synthetic data is enclosed in BEGIN / ROLLBACK. No external APIs are called.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $test$
DECLARE
  v_owner CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  IF (SELECT count(*) FROM auth.users) <> 0
     OR (SELECT count(*) FROM public.paper_accounts) <> 0
     OR (SELECT count(*) FROM public.audit_logs) <> 0
     OR (SELECT count(*) FROM public.paper_orders) <> 0
     OR (SELECT count(*) FROM public.paper_positions) <> 0 THEN
    RAISE EXCEPTION 'Test must start with an empty disposable database';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created'
       AND tgenabled='O' AND NOT tgisinternal) <> 1 THEN
    RAISE EXCEPTION 'Original signup trigger was not installed';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgname LIKE 'trg_audit_%' AND tgenabled='O' AND NOT tgisinternal) <> 5 THEN
    RAISE EXCEPTION 'Expected five active configuration audit triggers';
  END IF;
  IF has_function_privilege('anon','public.audit_configuration_change()','EXECUTE')
     OR has_function_privilege('authenticated','public.audit_configuration_change()','EXECUTE')
     OR NOT has_function_privilege('service_role','public.audit_configuration_change()','EXECUTE')
     OR has_table_privilege('authenticated','public.audit_logs','INSERT') THEN
    RAISE EXCEPTION 'Configuration-audit execution or write privileges unsafe';
  END IF;

  INSERT INTO auth.users(id,email,raw_user_meta_data)
    VALUES(v_owner, 'only-a-synthetic-fixture@example.invalid', '{"display_name":"CI Signup"}'::jsonb);

  IF (SELECT count(*) FROM public.profiles WHERE id=v_owner) <> 1
     OR (SELECT count(*) FROM public.bot_config WHERE owner_id=v_owner) <> 1
     OR (SELECT count(*) FROM public.risk_limits WHERE owner_id=v_owner) <> 1
     OR (SELECT count(*) FROM public.paper_accounts WHERE owner_id=v_owner) <> 1
     OR (SELECT count(*) FROM public.assets WHERE owner_id=v_owner) <> 5
     OR (SELECT count(*) FROM public.trading_strategies WHERE owner_id=v_owner) <> 7 THEN
    RAISE EXCEPTION 'Signup did not create the expected 1+1+1+1+5+7 records';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bot_config
       WHERE owner_id=v_owner AND trading_mode='paper' AND status='stopped'
         AND live_trading_enabled=false AND allow_withdrawals=false AND binance_testnet=true)
     OR NOT EXISTS (SELECT 1 FROM public.risk_limits
       WHERE owner_id=v_owner AND leverage=0 AND stop_loss_required=true)
     OR NOT EXISTS (SELECT 1 FROM public.paper_accounts
       WHERE owner_id=v_owner AND initial_balance=0 AND cash_balance=0
         AND source='paper')
     OR EXISTS (SELECT 1 FROM public.assets
       WHERE owner_id=v_owner AND auto_trade_enabled=true)
     OR EXISTS (SELECT 1 FROM public.trading_strategies
       WHERE owner_id=v_owner AND enabled=true)
     OR EXISTS (SELECT 1 FROM public.paper_orders)
     OR EXISTS (SELECT 1 FROM public.paper_positions) THEN
    RAISE EXCEPTION 'Signup changed an execution safety setting';
  END IF;

  IF (SELECT count(*) FROM public.audit_logs) <> 15
     OR (SELECT count(*) FROM public.audit_logs
          WHERE owner_id=v_owner AND action='configuration_insert'
            AND source='db_trigger' AND status='success') <> 15
     OR (SELECT count(*) FROM public.audit_logs
          WHERE entity='bot_config' AND action='configuration_insert') <> 1
     OR (SELECT count(*) FROM public.audit_logs
          WHERE entity='risk_limits' AND action='configuration_insert') <> 1
     OR (SELECT count(*) FROM public.audit_logs
          WHERE entity='paper_accounts' AND action='configuration_insert') <> 1
     OR (SELECT count(*) FROM public.audit_logs
          WHERE entity='assets' AND action='configuration_insert') <> 5
     OR (SELECT count(*) FROM public.audit_logs
          WHERE entity='trading_strategies' AND action='configuration_insert') <> 7 THEN
    RAISE EXCEPTION 'Expected exactly fifteen configuration_insert audit rows';
  END IF;

  IF EXISTS (
      SELECT 1 FROM public.audit_logs a
      WHERE jsonb_typeof(a.details) <> 'object'
        OR jsonb_typeof(a.details -> 'changed_fields') <> 'array'
        OR NOT (a.details ? 'row_id')
        OR a.details ->> 'row_id' IS NULL
    )
     OR EXISTS (
      SELECT 1 FROM public.audit_logs a
      CROSS JOIN LATERAL jsonb_object_keys(a.details) AS k(key)
      WHERE k.key NOT IN ('row_id','changed_fields')
    )
     OR EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE details::text ~* '(password|token|secret|email)'
    ) THEN
    RAISE EXCEPTION 'Audit metadata includes unexpected values or secret-bearing fields';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.audit_logs a
        JOIN public.paper_accounts pa
          ON a.details->>'row_id'=pa.id::text
        WHERE a.entity='paper_accounts' AND a.owner_id=v_owner
          AND a.details->'changed_fields' ? 'initial_balance') THEN
    RAISE EXCEPTION 'Paper account audit must reference its inserted record';
  END IF;

  RAISE NOTICE 'PASS: signup provisioned 15 audited rows; safe defaults; no trades';
END
$test$;

-- The signed JWT flow is NOT tested here. This only simulates the PostgREST
-- database role and owner claim to verify RLS policy behavior.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $rls$
BEGIN
  IF (SELECT count(*) FROM public.audit_logs) <> 15
     OR (SELECT count(*) FROM public.paper_accounts) <> 1 THEN
    RAISE EXCEPTION 'Owner did not see their own audit records';
  END IF;
  RAISE NOTICE 'PASS: authenticated owner sees own configuration audit';
END
$rls$;

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $rls$
BEGIN
  IF (SELECT count(*) FROM public.audit_logs) <> 0
     OR (SELECT count(*) FROM public.paper_accounts) <> 0 THEN
    RAISE EXCEPTION 'RLS leaked another owner audit or account';
  END IF;
  RAISE NOTICE 'PASS: another owner sees no audit or account';
END
$rls$;
RESET ROLE;

-- Rejecting an audit INSERT must reject the ENTIRE signup, not leave a
-- half-provisioned user, bot, account or asset.
SAVEPOINT reject_signup;
ALTER TABLE public.audit_logs ADD CONSTRAINT reject_signup_audit_ci
  CHECK (action <> 'configuration_insert') NOT VALID;
DO $atomic$
DECLARE
  v_bad CONSTANT uuid := '33333333-3333-4333-8333-333333333333';
  v_rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO auth.users(id,email)
      VALUES(v_bad,'rejected-signup@example.invalid');
  EXCEPTION WHEN check_violation THEN
    IF position('reject_signup_audit_ci' IN SQLERRM)=0 THEN
      RAISE;
    END IF;
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Signup unexpectedly survived an audit-write rejection';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id=v_bad)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE id=v_bad)
     OR EXISTS (SELECT 1 FROM public.bot_config WHERE owner_id=v_bad)
     OR EXISTS (SELECT 1 FROM public.risk_limits WHERE owner_id=v_bad)
     OR EXISTS (SELECT 1 FROM public.paper_accounts WHERE owner_id=v_bad)
     OR EXISTS (SELECT 1 FROM public.assets WHERE owner_id=v_bad)
     OR EXISTS (SELECT 1 FROM public.trading_strategies WHERE owner_id=v_bad)
     OR (SELECT count(*) FROM public.audit_logs) <> 15 THEN
    RAISE EXCEPTION 'Failed signup left orphaned or partial records';
  END IF;
  RAISE NOTICE 'PASS: forced audit error atomically rejects entire signup';
END
$atomic$;
ROLLBACK TO SAVEPOINT reject_signup;

DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reject_signup_audit_ci')
     OR (SELECT count(*) FROM auth.users) <> 1
     OR (SELECT count(*) FROM public.audit_logs) <> 15 THEN
    RAISE EXCEPTION 'Savepoint cleanup changed initial signup or kept test constraint';
  END IF;
END
$check$;

ROLLBACK;

-- Strong postcondition after rollback in the throwaway CI database.
DO $verify$
BEGIN
  IF (SELECT count(*) FROM auth.users) <> 0
     OR (SELECT count(*) FROM public.profiles) <> 0
     OR (SELECT count(*) FROM public.bot_config) <> 0
     OR (SELECT count(*) FROM public.risk_limits) <> 0
     OR (SELECT count(*) FROM public.paper_accounts) <> 0
     OR (SELECT count(*) FROM public.assets) <> 0
     OR (SELECT count(*) FROM public.trading_strategies) <> 0
     OR (SELECT count(*) FROM public.audit_logs) <> 0
     OR (SELECT count(*) FROM public.paper_orders) <> 0
     OR (SELECT count(*) FROM public.paper_positions) <> 0
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reject_signup_audit_ci') THEN
    RAISE EXCEPTION 'Outer rollback did not restore the pristine database';
  END IF;
  RAISE NOTICE 'PASS: outer ROLLBACK left zero users, accounts, orders, positions and audits';
END
$verify$;
