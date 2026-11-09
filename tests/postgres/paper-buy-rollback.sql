-- Disposable PostgreSQL only. Force a failure AFTER cash debit and position insert.
DO $$
DECLARE
  owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  failed boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  -- Fail the audit insert after the engine has updated cash and inserted both
  -- a position and an order. The entire function call must roll back.
  CREATE OR REPLACE FUNCTION public.reject_paper_audit_for_test()
  RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    RAISE EXCEPTION 'forced audit failure';
  END $fn$;
  CREATE TRIGGER trg_reject_paper_audit_for_test
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.reject_paper_audit_for_test();
  BEGIN
    PERFORM public.execute_paper_buy(owner,'rollback-order-0001','BTCUSDT','test_strategy',1,50,49.75,0.001,now());
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'forced audit failure' THEN failed := true;
    ELSE RAISE; END IF;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Expected forced audit failure'; END IF;
  IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) <> 100 THEN
    RAISE EXCEPTION 'Cash debit persisted after transaction failed';
  END IF;
  IF (SELECT count(*) FROM public.paper_positions) <> 0 OR
     (SELECT count(*) FROM public.paper_orders) <> 0 OR
     (SELECT count(*) FROM public.audit_logs) <> 0 THEN
    RAISE EXCEPTION 'Partial order or position persisted after rollback';
  END IF;
  DROP TRIGGER trg_reject_paper_audit_for_test ON public.audit_logs;
  DROP FUNCTION public.reject_paper_audit_for_test();
END $$;
