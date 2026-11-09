-- Disposable PostgreSQL only. Missing mandatory owner configuration must fail closed.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 before_cash numeric;
 rejected boolean;
 i integer;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
 FOR i IN 1..5 LOOP
   rejected := false;
   BEGIN
     CASE i
       WHEN 1 THEN DELETE FROM public.bot_config WHERE owner_id=owner;
       WHEN 2 THEN DELETE FROM public.risk_limits WHERE owner_id=owner;
       WHEN 3 THEN DELETE FROM public.assets WHERE owner_id=owner;
       WHEN 4 THEN DELETE FROM public.trading_strategies WHERE owner_id=owner;
       WHEN 5 THEN UPDATE public.paper_accounts SET status='inactive' WHERE owner_id=owner;
     END CASE;
     PERFORM public.execute_paper_buy(owner,'missing-record-0'||i,'BTCUSDT','test_strategy',1,50,49.75,0.001,now());
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Missing mandatory record case % was accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
     OR (SELECT count(*) FROM public.paper_orders) <> 0
     OR (SELECT count(*) FROM public.paper_positions) <> 0
     OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Missing mandatory record case % wrote account data',i;
   END IF;
   -- Restore fixture for the next case.
   INSERT INTO public.bot_config(owner_id,trading_mode,live_trading_enabled,allow_withdrawals,status)
     VALUES(owner,'paper',false,false,'running') ON CONFLICT(owner_id) DO NOTHING;
   INSERT INTO public.risk_limits(owner_id,leverage,max_risk_per_trade_pct,max_daily_loss_pct,max_open_positions)
     VALUES(owner,0,0.5,1,2) ON CONFLICT(owner_id) DO NOTHING;
   INSERT INTO public.assets(owner_id,symbol,auto_trade_enabled,deleted_at,status)
     SELECT owner,'BTCUSDT',true,NULL,'active'
     WHERE NOT EXISTS(SELECT 1 FROM public.assets WHERE owner_id=owner AND symbol='BTCUSDT');
   INSERT INTO public.trading_strategies(owner_id,strategy_key,enabled,status)
     SELECT owner,'test_strategy',true,'active'
     WHERE NOT EXISTS(SELECT 1 FROM public.trading_strategies WHERE owner_id=owner AND strategy_key='test_strategy');
   UPDATE public.paper_accounts SET status='active' WHERE owner_id=owner;
 END LOOP;
END $$;
