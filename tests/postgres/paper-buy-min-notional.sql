-- Disposable PostgreSQL fixture ONLY. Never run on the real Lovable database.
-- The previously installed migration 0002 is upgraded to 0004 in the CI job.
-- A rejected order must leave cash, positions, orders, and audit unchanged.
DO $$
DECLARE
  v_owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_cash numeric;
  v_order_id uuid;
  v_error text;
  v_i integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT cash_balance INTO STRICT v_cash
    FROM public.paper_accounts WHERE owner_id=v_owner;
  IF v_cash <> 100 THEN
    RAISE EXCEPTION 'Expected a fresh test fixture with 100 USDT';
  END IF;
  IF (SELECT count(*) FROM public.paper_orders) <> 0
      OR (SELECT count(*) FROM public.paper_positions) <> 0
      OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
    RAISE EXCEPTION 'Expected an empty disposable ledger';
  END IF;

  -- Both extremely small and just-below-5 USDT must fail explicitly.
  FOR v_i IN 1..2 LOOP
    v_error := NULL;
    BEGIN
      IF v_i=1 THEN
        PERFORM public.execute_paper_buy(
          v_owner, 'min-notional-tiny-001', 'BTCUSDT', 'ema',
          0.0000001, 75000, 74000, 0.001, now()
        );
      ELSE
        PERFORM public.execute_paper_buy(
          v_owner, 'min-notional-under-5', 'BTCUSDT', 'ema',
          0.099998, 50, 49.75, 0.001, now()
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    END;
    IF v_error IS DISTINCT FROM 'Paper buy notional below 5 USDT' THEN
      RAISE EXCEPTION 'Minimum-notional rejection was not enforced (case %, message %)',
        v_i, v_error;
    END IF;
    IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=v_owner) IS DISTINCT FROM v_cash
       OR (SELECT count(*) FROM public.paper_orders) <> 0
       OR (SELECT count(*) FROM public.paper_positions) <> 0
       OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
      RAISE EXCEPTION 'Rejected minimum-notional order modified account or ledger';
    END IF;
  END LOOP;

  -- Exactly 5 USDT is valid if all other paper settings and risk tests pass.
  -- Raise a controlled exception AFTER verifying writes so the test rolls back
  -- that valid sample, retaining a pristine ledger for the existing CI suite.
  BEGIN
    v_order_id := public.execute_paper_buy(
      v_owner, 'min-notional-exact-5', 'BTCUSDT', 'ema',
      0.1, 50, 49.75, 0.001, now()
    );
    IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=v_owner) <> 94.995
       OR (SELECT count(*) FROM public.paper_orders WHERE id=v_order_id) <> 1
       OR (SELECT count(*) FROM public.paper_positions WHERE owner_id=v_owner) <> 1
       OR (SELECT count(*) FROM public.audit_logs WHERE owner_id=v_owner) <> 1 THEN
      RAISE EXCEPTION 'Exactly-5-USDT valid paper order did not produce a consistent ledger';
    END IF;
    RAISE EXCEPTION 'MIN_NOTIONAL_SUCCESS_PROBE_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'MIN_NOTIONAL_SUCCESS_PROBE_ROLLBACK' THEN RAISE; END IF;
  END;

  IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=v_owner) IS DISTINCT FROM v_cash
     OR (SELECT count(*) FROM public.paper_orders) <> 0
     OR (SELECT count(*) FROM public.paper_positions) <> 0
     OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
    RAISE EXCEPTION 'The successful boundary probe was not completely rolled back';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public' AND p.proname='execute_paper_buy'
      AND p.prosecdef IS TRUE
      AND pg_get_functiondef(p.oid) LIKE '%v_notional < 5%'
      AND pg_get_functiondef(p.oid) LIKE '%source = ''paper''%'
  ) THEN
    RAISE EXCEPTION 'Function guard, security definer or paper-account isolation missing';
  END IF;
END $$;
