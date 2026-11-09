-- Disposable PostgreSQL only: a reused client order id must never debit twice.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 first_order uuid;
 balance_after numeric;
 rejected boolean := false;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 first_order := public.execute_paper_buy(owner,'idempotency-0001','BTCUSDT','ema',0.5,50,49.75,0.001,now());
 SELECT cash_balance INTO balance_after FROM public.paper_accounts WHERE owner_id=owner;
 IF balance_after <> 74.975 THEN RAISE EXCEPTION 'Unexpected balance after first purchase: %',balance_after; END IF;
 BEGIN
   -- Same ID with different valid order parameters must still be rejected.
   PERFORM public.execute_paper_buy(owner,'idempotency-0001','BTCUSDT','ema',0.25,50,49.75,0.001,now());
 EXCEPTION WHEN OTHERS THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Reused client order ID was accepted'; END IF;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM balance_after
    OR (SELECT count(*) FROM public.paper_orders WHERE owner_id=owner) <> 1
    OR (SELECT count(*) FROM public.paper_positions WHERE owner_id=owner) <> 1
    OR (SELECT count(*) FROM public.audit_logs WHERE owner_id=owner) <> 1
    OR (SELECT id FROM public.paper_orders WHERE owner_id=owner AND client_order_id='idempotency-0001') IS DISTINCT FROM first_order
 THEN RAISE EXCEPTION 'Duplicate request altered original purchase'; END IF;
 -- Clean up the isolated fixture for subsequent tests.
 DELETE FROM public.paper_orders WHERE owner_id=owner;
 DELETE FROM public.paper_positions WHERE owner_id=owner;
 DELETE FROM public.audit_logs WHERE owner_id=owner;
 UPDATE public.paper_accounts SET cash_balance=100 WHERE owner_id=owner;
END $$;
