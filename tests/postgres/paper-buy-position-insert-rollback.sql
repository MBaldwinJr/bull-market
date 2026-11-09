-- Disposable PostgreSQL only: position insert failure must reverse the prior cash debit.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 failed boolean := false;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 CREATE OR REPLACE FUNCTION public.reject_paper_position_for_test()
 RETURNS trigger LANGUAGE plpgsql AS $fn$
 BEGIN
   RAISE EXCEPTION 'forced paper position insert failure';
 END $fn$;
 CREATE TRIGGER trg_reject_paper_position_for_test
   BEFORE INSERT ON public.paper_positions
   FOR EACH ROW EXECUTE FUNCTION public.reject_paper_position_for_test();
 BEGIN
   PERFORM public.execute_paper_buy(owner,'position-rollback-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM = 'forced paper position insert failure' THEN failed := true;
   ELSE RAISE; END IF;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Expected forced paper position insert failure'; END IF;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM 100
    OR (SELECT count(*) FROM public.paper_positions) <> 0
    OR (SELECT count(*) FROM public.paper_orders) <> 0
    OR (SELECT count(*) FROM public.audit_logs) <> 0
 THEN RAISE EXCEPTION 'Position insert failure left partial data or cash debit'; END IF;
 DROP TRIGGER trg_reject_paper_position_for_test ON public.paper_positions;
 DROP FUNCTION public.reject_paper_position_for_test();
END $$;
