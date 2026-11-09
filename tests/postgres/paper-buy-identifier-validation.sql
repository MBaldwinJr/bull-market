-- Disposable PostgreSQL only: validate order id and asset symbol formats.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 before_cash numeric;
 rejected boolean;
 i integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR i IN 1..7 LOOP
   rejected := false;
   BEGIN
     CASE i
       WHEN 1 THEN PERFORM public.execute_paper_buy(owner,'short','BTCUSDT','test_strategy',1,50,49.75,0.001,now());
       WHEN 2 THEN PERFORM public.execute_paper_buy(owner,repeat('x',129),'BTCUSDT','test_strategy',1,50,49.75,0.001,now());
       WHEN 3 THEN PERFORM public.execute_paper_buy(owner,'bad-symbol-03','btcUSDT','test_strategy',1,50,49.75,0.001,now());
       WHEN 4 THEN PERFORM public.execute_paper_buy(owner,'bad-symbol-04','BTC-USDT','test_strategy',1,50,49.75,0.001,now());
       WHEN 5 THEN PERFORM public.execute_paper_buy(owner,'bad-symbol-05','B','test_strategy',1,50,49.75,0.001,now());
       WHEN 6 THEN PERFORM public.execute_paper_buy(owner,'bad-symbol-06',repeat('B',21),'test_strategy',1,50,49.75,0.001,now());
       WHEN 7 THEN PERFORM public.execute_paper_buy(owner,'bad-strategy-07','BTCUSDT','   ',1,50,49.75,0.001,now());
     END CASE;
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Invalid identifier case % was accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
      OR (SELECT count(*) FROM public.paper_orders) <> 0
      OR (SELECT count(*) FROM public.paper_positions) <> 0
      OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Invalid identifier case % caused a write',i;
   END IF;
 END LOOP;
END $$;
