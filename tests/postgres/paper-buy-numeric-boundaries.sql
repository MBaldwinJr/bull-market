-- Disposable PostgreSQL only: reject invalid numerical boundaries atomically.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 before_cash numeric;
 rejected boolean;
 i integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR i IN 1..8 LOOP
   rejected := false;
   BEGIN
     CASE i
       WHEN 1 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-01','BTCUSDT','test_strategy',0,50,49.75,0.001,now());
       WHEN 2 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-02','BTCUSDT','test_strategy',-1,50,49.75,0.001,now());
       WHEN 3 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-03','BTCUSDT','test_strategy',1,0,0.01,0.001,now());
       WHEN 4 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-04','BTCUSDT','test_strategy',1,-50,1,0.001,now());
       WHEN 5 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-05','BTCUSDT','test_strategy',1,50,0,0.001,now());
       WHEN 6 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-06','BTCUSDT','test_strategy',1,50,50,0.001,now());
       WHEN 7 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-07','BTCUSDT','test_strategy',1,50,51,0.001,now());
       WHEN 8 THEN PERFORM public.execute_paper_buy(owner,'numeric-invalid-08','BTCUSDT','test_strategy',1,50,49.75,-0.001,now());
     END CASE;
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Invalid numerical boundary case % was accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
      OR (SELECT count(*) FROM public.paper_orders) <> 0
      OR (SELECT count(*) FROM public.paper_positions) <> 0
      OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Invalid numerical boundary case % caused a write',i;
   END IF;
 END LOOP;
END $$;
