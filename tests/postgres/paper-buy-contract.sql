-- Assertions based on read-only introspection of the real Bull Market schema.
-- Runs on disposable PostgreSQL after migration 0002 is installed.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='paper_orders_owner_id_client_order_id_key' AND contype='u') THEN
   RAISE NOTICE 'Fixture has no production idempotency unique constraint; use dedicated parity fixture';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='execute_paper_buy' AND p.prosecdef) THEN
   RAISE EXCEPTION 'Paper buy function must be SECURITY DEFINER';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='execute_paper_buy' AND pg_get_functiondef(p.oid) NOT LIKE '%source = ''paper''%') THEN
   RAISE EXCEPTION 'Paper buy must filter paper-only accounts';
 END IF;
END $$;
