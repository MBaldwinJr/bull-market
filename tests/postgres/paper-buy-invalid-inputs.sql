-- Disposable PostgreSQL only. Reject invalid input before any mutation.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 before_cash numeric;
 rejected boolean;
 row_count integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR row_count IN 1..7 LOOP
   rejected := false;
   BEGIN
     CASE row_count
       WHEN 1 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-01',NULL,'test_strategy',1,50,49.75,0.001,now());
       WHEN 2 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-02','BTCUSDT',NULL,1,50,49.75,0.001,now());
       WHEN 3 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-03','BTCUSDT','test_strategy',NULL,50,49.75,0.001,now());
       WHEN 4 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-04','BTCUSDT','test_strategy',1,NULL,49.75,0.001,now());
       WHEN 5 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-05','BTCUSDT','test_strategy',1,50,NULL,0.001,now());
       WHEN 6 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-06','BTCUSDT','test_strategy',1,50,49.75,NULL,now());
       WHEN 7 THEN PERFORM public.execute_paper_buy(owner,'invalid-order-07','BTCUSDT','test_strategy',1,50,49.75,0.001,NULL);
     END CASE;
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Invalid input case % was accepted',row_count; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash THEN
     RAISE EXCEPTION 'Invalid input case % modified cash',row_count;
   END IF;
   IF (SELECT count(*) FROM public.paper_orders) <> 0 OR
      (SELECT count(*) FROM public.paper_positions) <> 0 OR
      (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Invalid input case % wrote partial records',row_count;
   END IF;
 END LOOP;
END $$;
