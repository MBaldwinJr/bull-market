-- Disposable PostgreSQL only. Failure at order insertion must roll back cash and position.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 failed boolean := false;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 CREATE OR REPLACE FUNCTION public.reject_paper_order_for_test()
 RETURNS trigger LANGUAGE plpgsql AS $fn$
 BEGIN
   RAISE EXCEPTION 'forced paper order insert failure';
 END $fn$;
 CREATE TRIGGER trg_reject_paper_order_for_test
   BEFORE INSERT ON public.paper_orders
   FOR EACH ROW EXECUTE FUNCTION public.reject_paper_order_for_test();
 BEGIN
   PERFORM public.execute_paper_buy(owner,'order-rollback-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM = 'forced paper order insert failure' THEN failed := true;
   ELSE RAISE; END IF;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Expected forced paper order insert failure'; END IF;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM 100
    OR (SELECT count(*) FROM public.paper_positions) <> 0
    OR (SELECT count(*) FROM public.paper_orders) <> 0
    OR (SELECT count(*) FROM public.audit_logs) <> 0
 THEN RAISE EXCEPTION 'Order insertion failure left partial records or cash debit'; END IF;
 DROP TRIGGER trg_reject_paper_order_for_test ON public.paper_orders;
 DROP FUNCTION public.reject_paper_order_for_test();
END $$;
