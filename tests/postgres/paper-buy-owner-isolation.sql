-- Disposable PostgreSQL only: another owner's assets and strategies
-- must not authorize an order on the first owner's paper account.
DO $$
DECLARE
 owner_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 owner_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 before_cash numeric;
 rejected boolean;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO public.paper_accounts(owner_id,initial_balance,cash_balance)
 VALUES(owner_b,100,100);
 INSERT INTO public.bot_config(owner_id,trading_mode,live_trading_enabled,allow_withdrawals,status)
 VALUES(owner_b,'paper',false,false,'running');
 INSERT INTO public.risk_limits(owner_id,leverage,max_risk_per_trade_pct,max_daily_loss_pct,max_open_positions)
 VALUES(owner_b,0,0.5,1,2);
 INSERT INTO public.assets(owner_id,symbol,auto_trade_enabled,deleted_at,status)
 VALUES(owner_b,'ETHUSDT',true,NULL,'active');
 INSERT INTO public.trading_strategies(owner_id,strategy_key,enabled,status)
 VALUES(owner_b,'rsi',true,'active');
 SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner_a;
 rejected := false;
 BEGIN
   PERFORM public.execute_paper_buy(owner_a,'owner-isolation-01','ETHUSDT','ema',1,50,49.75,0.001,now());
 EXCEPTION WHEN OTHERS THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-owner asset was accepted'; END IF;
 rejected := false;
 BEGIN
   PERFORM public.execute_paper_buy(owner_a,'owner-isolation-02','BTCUSDT','rsi',1,50,49.75,0.001,now());
 EXCEPTION WHEN OTHERS THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-owner strategy was accepted'; END IF;
 IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner_a) IS DISTINCT FROM before_cash
   OR (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner_b) IS DISTINCT FROM 100
   OR (SELECT count(*) FROM public.paper_orders) <> 0
   OR (SELECT count(*) FROM public.paper_positions) <> 0
   OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
   RAISE EXCEPTION 'Cross-owner rejection changed account records';
 END IF;
END $$;
