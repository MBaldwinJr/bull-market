-- Disposable PostgreSQL only. Prove production-like CHECK/UNIQUE constraints are active.
DO $$
DECLARE
 owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 rejected boolean;
 i integer;
BEGIN
 FOR i IN 1..6 LOOP
   rejected := false;
   BEGIN
     CASE i
       WHEN 1 THEN INSERT INTO public.assets(owner_id,symbol,auto_trade_enabled,status) VALUES(owner,'BTCUSDT',true,'active');
       WHEN 2 THEN INSERT INTO public.assets(owner_id,symbol,auto_trade_enabled,status) VALUES(owner,'btcUSDT',true,'active');
       WHEN 3 THEN INSERT INTO public.trading_strategies(owner_id,strategy_key,enabled) VALUES(owner,'ema',true);
       WHEN 4 THEN INSERT INTO public.trading_strategies(owner_id,strategy_key,enabled) VALUES(owner,'unlisted_strategy',true);
       WHEN 5 THEN UPDATE public.bot_config SET trading_mode='live' WHERE owner_id=owner;
       WHEN 6 THEN UPDATE public.bot_config SET status='unknown' WHERE owner_id=owner;
     END CASE;
   EXCEPTION WHEN check_violation OR unique_violation THEN rejected := true;
   END;
   IF NOT rejected THEN RAISE EXCEPTION 'Constraint case % unexpectedly accepted',i; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.assets WHERE owner_id=owner) <> 1
    OR (SELECT count(*) FROM public.trading_strategies WHERE owner_id=owner) <> 1
    OR (SELECT trading_mode FROM public.bot_config WHERE owner_id=owner) IS DISTINCT FROM 'paper'
    OR (SELECT status FROM public.bot_config WHERE owner_id=owner) IS DISTINCT FROM 'running'
 THEN RAISE EXCEPTION 'Rejected constraint tests altered fixture records'; END IF;
END $$;
