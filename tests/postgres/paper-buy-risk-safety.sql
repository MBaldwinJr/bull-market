-- Disposable PostgreSQL only: every unsafe configuration must fail closed.
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
   UPDATE public.bot_config SET trading_mode='paper', live_trading_enabled=false,
     allow_withdrawals=false, status='running' WHERE owner_id=owner;
   UPDATE public.risk_limits SET status='active',stop_loss_required=true,leverage=0,
     max_risk_per_trade_pct=0.5,max_daily_loss_pct=1,max_open_positions=2 WHERE owner_id=owner;
   UPDATE public.trading_strategies SET enabled=true,status='active' WHERE owner_id=owner;
   UPDATE public.assets SET auto_trade_enabled=true,status='active' WHERE owner_id=owner;
   CASE i
     WHEN 1 THEN UPDATE public.bot_config SET status='stopped' WHERE owner_id=owner;
     WHEN 2 THEN UPDATE public.bot_config SET trading_mode='testnet' WHERE owner_id=owner;
     WHEN 3 THEN UPDATE public.risk_limits SET status='inactive' WHERE owner_id=owner;
     WHEN 4 THEN UPDATE public.risk_limits SET max_open_positions=0 WHERE owner_id=owner;
     WHEN 5 THEN UPDATE public.trading_strategies SET enabled=false WHERE owner_id=owner;
     WHEN 6 THEN UPDATE public.assets SET auto_trade_enabled=false WHERE owner_id=owner;
     WHEN 7 THEN UPDATE public.risk_limits SET max_risk_per_trade_pct=NULL WHERE owner_id=owner;
   END CASE;
   rejected := false;
   BEGIN
     PERFORM public.execute_paper_buy(owner,'unsafe-config-000'||i,'BTCUSDT','test_strategy',1,50,49.75,0.001,now());
   EXCEPTION WHEN OTHERS THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Unsafe configuration case % was accepted',i; END IF;
   IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) IS DISTINCT FROM before_cash
     OR (SELECT count(*) FROM public.paper_orders) <> 0
     OR (SELECT count(*) FROM public.paper_positions) <> 0
     OR (SELECT count(*) FROM public.audit_logs) <> 0 THEN
     RAISE EXCEPTION 'Unsafe configuration case % changed account records',i;
   END IF;
 END LOOP;
 UPDATE public.bot_config SET trading_mode='paper',live_trading_enabled=false,
   allow_withdrawals=false,status='running' WHERE owner_id=owner;
 UPDATE public.risk_limits SET status='active',stop_loss_required=true,leverage=0,
   max_risk_per_trade_pct=0.5,max_daily_loss_pct=1,max_open_positions=2 WHERE owner_id=owner;
 UPDATE public.trading_strategies SET enabled=true,status='active' WHERE owner_id=owner;
 UPDATE public.assets SET auto_trade_enabled=true,status='active' WHERE owner_id=owner;
END $$;
