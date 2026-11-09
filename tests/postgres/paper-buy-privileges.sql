-- Disposable PostgreSQL fixture only. Verify actual SQL role grants.
DO $$
DECLARE
 signature text := 'public.execute_paper_buy(uuid,text,text,text,numeric,numeric,numeric,numeric,timestamptz)';
BEGIN
 IF has_function_privilege('authenticated',signature,'EXECUTE') THEN
   RAISE EXCEPTION 'authenticated unexpectedly has EXECUTE privilege';
 END IF;
 IF has_function_privilege('anon',signature,'EXECUTE') THEN
   RAISE EXCEPTION 'anon unexpectedly has EXECUTE privilege';
 END IF;
 IF NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
   RAISE EXCEPTION 'service_role lacks EXECUTE privilege';
 END IF;
END $$;
-- Verify a genuine SET ROLE cannot bypass the function's auth.role() guard.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$
DECLARE
 rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.execute_paper_buy('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'forbidden-order-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
 EXCEPTION WHEN insufficient_privilege THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'authenticated invoked restricted function'; END IF;
END $$;
RESET ROLE;

-- Verify the function is not executable by PUBLIC and cannot be called as anon.
DO $$
DECLARE
 signature text := 'public.execute_paper_buy(uuid,text,text,text,numeric,numeric,numeric,numeric,timestamptz)';
BEGIN
 IF has_function_privilege('public',signature,'EXECUTE') THEN
   RAISE EXCEPTION 'PUBLIC unexpectedly has EXECUTE privilege';
 END IF;
END $$;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role','anon',false);
DO $$
DECLARE
 rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.execute_paper_buy('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'forbidden-anon-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
 EXCEPTION WHEN insufficient_privilege THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'anon invoked restricted function'; END IF;
END $$;
RESET ROLE;
