-- Disposable PostgreSQL only: invalid account identities must fail closed.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 unknown_owner uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 before_cash numeric;
 rejected boolean;
 i integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR i IN 1..3 LOOP
   rejected := false;
   IF i=3 THEN UPDATE public.paper_accounts SET source='external' WHERE owner_id=owner; END IF;
   BEGIN
     CASE i
       WHEN 1 THEN PERFORM public.execute_paper_buy(NULL,'account-identity-01','BTCUSDT','ema',1,50,49.75,0.001,now());
       WHEN 2 THEN PERFORM public.execute_paper_buy(unknown_owner,'account-identity-02','BTCUSDT','ema',1,50,49.75,0.001,now());
       WHEN 3 THEN PERFORM public.execute_paper_buy(owner,'account-identity-03','BTCUSDT','ema',1,50,49.75,0.001,now());
     END CASE;
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Invalid account identity case % accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
      OR (SELECT count(*) FROM public.paper_orders) <> 0
      OR (SELECT count(*) FROM public.paper_positions) <> 0
      OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Invalid account identity case % wrote data',i;
   END IF;
   IF i=3 THEN UPDATE public.paper_accounts SET source='paper' WHERE owner_id=owner; END IF;
 END LOOP;
END $$;
