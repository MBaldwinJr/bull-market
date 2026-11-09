-- Disposable PostgreSQL only: cash, risk, open-position and daily-loss caps.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 account uuid;
 before_cash numeric;
 rejected boolean;
 i integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT id,cash_balance INTO account,before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR i IN 1..4 LOOP
   rejected := false;
   IF i=3 THEN
     INSERT INTO public.paper_positions(owner_id,account_id,symbol,side,quantity,entry_price,stop_loss,status,source)
       VALUES(owner,account,'BTCUSDT','long',1,50,49.75,'open','paper');
     UPDATE public.risk_limits SET max_open_positions=1 WHERE owner_id=owner;
   ELSIF i=4 THEN
     INSERT INTO public.paper_positions(owner_id,account_id,symbol,side,quantity,entry_price,stop_loss,status,source,closed_at,realized_pnl)
       VALUES(owner,account,'BTCUSDT','long',1,50,49.75,'closed','paper',now(),-2);
   END IF;
   BEGIN
     CASE i
       WHEN 1 THEN PERFORM public.execute_paper_buy(owner,'finance-limit-01','BTCUSDT','ema',3,50,49.99,0.001,now());
       WHEN 2 THEN PERFORM public.execute_paper_buy(owner,'finance-limit-02','BTCUSDT','ema',1,50,49,0.001,now());
       WHEN 3 THEN PERFORM public.execute_paper_buy(owner,'finance-limit-03','BTCUSDT','ema',1,50,49.99,0.001,now());
       WHEN 4 THEN PERFORM public.execute_paper_buy(owner,'finance-limit-04','BTCUSDT','ema',1,50,49.99,0.001,now());
     END CASE;
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Financial risk case % was accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
     OR (SELECT count(*) FROM public.paper_orders) <> 0
     OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Financial risk case % wrote cash/order/audit',i;
   END IF;
   DELETE FROM public.paper_positions WHERE owner_id=owner;
   UPDATE public.risk_limits SET max_open_positions=2 WHERE owner_id=owner;
 END LOOP;
END $$;
