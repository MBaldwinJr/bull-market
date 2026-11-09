DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 account uuid;
 failed boolean;
BEGIN
 SELECT id INTO account FROM public.paper_accounts WHERE owner_id=owner;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claim.sub',owner::text,true);
 UPDATE public.paper_accounts SET initial_balance=125 WHERE id=account;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE id=account) <> 125 THEN
   RAISE EXCEPTION 'Opening balance did not mirror into cash';
 END IF;
 -- Simulate the engine writing its first order: trigger must set marker.
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO public.paper_orders(owner_id,account_id) VALUES(owner,account);
 IF (SELECT first_trade_at FROM public.paper_accounts WHERE id=account) IS NULL THEN
   RAISE EXCEPTION 'First-trade marker was not written';
 END IF;
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 failed := false;
 BEGIN
   UPDATE public.paper_accounts SET initial_balance=200 WHERE id=account;
 EXCEPTION WHEN OTHERS THEN failed := true;
 END;
 IF NOT failed AND (SELECT initial_balance FROM public.paper_accounts WHERE id=account) <> 125 THEN
   RAISE EXCEPTION 'Opening balance changed after first trade';
 END IF;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE id=account) <> 125 THEN
   RAISE EXCEPTION 'Rejected opening balance edit changed operational cash';
 END IF;
END $$;
