-- Disposable PostgreSQL: a failed order must not consume its client order ID.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 accepted_order uuid;
 rejected boolean := false;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 CREATE OR REPLACE FUNCTION public.fail_once_order_insert_test()
 RETURNS trigger LANGUAGE plpgsql AS $fn$
 BEGIN
   RAISE EXCEPTION 'forced first attempt failure';
 END $fn$;
 CREATE TRIGGER trg_fail_once_order_insert_test
   BEFORE INSERT ON public.paper_orders
   FOR EACH ROW EXECUTE FUNCTION public.fail_once_order_insert_test();
 BEGIN
   PERFORM public.execute_paper_buy(owner,'retry-after-rollback-001','BTCUSDT','ema',0.5,50,49.75,0.001,now());
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM = 'forced first attempt failure' THEN rejected := true;
   ELSE RAISE; END IF;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Expected first attempt to fail'; END IF;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) <> 100
    OR (SELECT count(*) FROM public.paper_orders) <> 0
    OR (SELECT count(*) FROM public.paper_positions) <> 0
    OR (SELECT count(*) FROM public.audit_logs) <> 0
 THEN RAISE EXCEPTION 'Failed attempt left partial data'; END IF;
 DROP TRIGGER trg_fail_once_order_insert_test ON public.paper_orders;
 DROP FUNCTION public.fail_once_order_insert_test();
 accepted_order := public.execute_paper_buy(owner,'retry-after-rollback-001','BTCUSDT','ema',0.5,50,49.75,0.001,now());
 IF accepted_order IS NULL
    OR (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) <> 74.975
    OR (SELECT count(*) FROM public.paper_orders WHERE client_order_id='retry-after-rollback-001') <> 1
    OR (SELECT count(*) FROM public.paper_positions) <> 1
    OR (SELECT count(*) FROM public.audit_logs) <> 1
 THEN RAISE EXCEPTION 'Safe retry failed or created incorrect ledger records'; END IF;
 DELETE FROM public.paper_orders WHERE owner_id=owner;
 DELETE FROM public.paper_positions WHERE owner_id=owner;
 DELETE FROM public.audit_logs WHERE owner_id=owner;
 UPDATE public.paper_accounts SET cash_balance=100 WHERE owner_id=owner;
END $$;
