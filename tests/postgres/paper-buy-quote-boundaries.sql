-- Disposable PostgreSQL only: reject stale/future quotes without side effects.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 before_cash numeric;
 rejected boolean;
 i integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR i IN 1..4 LOOP
   rejected := false;
   BEGIN
     CASE i
       WHEN 1 THEN PERFORM public.execute_paper_buy(owner,'quote-invalid-01','BTCUSDT','ema',1,50,49.75,0.001,now()-interval '31 seconds');
       WHEN 2 THEN PERFORM public.execute_paper_buy(owner,'quote-invalid-02','BTCUSDT','ema',1,50,49.75,0.001,now()-interval '10 minutes');
       WHEN 3 THEN PERFORM public.execute_paper_buy(owner,'quote-invalid-03','BTCUSDT','ema',1,50,49.75,0.001,now()+interval '6 seconds');
       WHEN 4 THEN PERFORM public.execute_paper_buy(owner,'quote-invalid-04','BTCUSDT','ema',1,50,49.75,0.001,now()+interval '1 hour');
     END CASE;
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Invalid quote timestamp case % was accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
      OR (SELECT count(*) FROM public.paper_orders) <> 0
      OR (SELECT count(*) FROM public.paper_positions) <> 0
      OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Invalid quote timestamp case % caused a write',i;
   END IF;
 END LOOP;
END $$;
