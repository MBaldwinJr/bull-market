-- READ ONLY. Run against a staging database before installing migration 0002.
-- Does not create tables, functions, roles, orders or positions.
DO $$
DECLARE
 missing text;
 required_tables text[] := ARRAY['paper_accounts','bot_config','risk_limits','assets','trading_strategies','paper_positions','paper_orders','audit_logs'];
 table_name text;
BEGIN
 FOREACH table_name IN ARRAY required_tables LOOP
   IF to_regclass('public.' || table_name) IS NULL THEN
     RAISE EXCEPTION 'Missing required table: public.%', table_name;
   END IF;
 END LOOP;
 IF to_regprocedure('auth.role()') IS NULL THEN
   RAISE EXCEPTION 'Missing auth.role() function';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   RAISE EXCEPTION 'Missing service_role database role';
 END IF;
 SELECT string_agg(format('%I.%I',v.table_name,v.column_name),', ')
 INTO missing
 FROM (VALUES
  ('paper_accounts','owner_id'),('paper_accounts','cash_balance'),('paper_accounts','initial_balance'),('paper_accounts','source'),('paper_accounts','status'),
  ('bot_config','owner_id'),('bot_config','trading_mode'),('bot_config','live_trading_enabled'),('bot_config','allow_withdrawals'),('bot_config','status'),
  ('risk_limits','owner_id'),('risk_limits','status'),('risk_limits','stop_loss_required'),('risk_limits','max_open_positions'),
  ('assets','owner_id'),('assets','symbol'),('assets','auto_trade_enabled'),('assets','status'),('assets','deleted_at'),
  ('trading_strategies','owner_id'),('trading_strategies','strategy_key'),('trading_strategies','enabled'),('trading_strategies','status'),
  ('paper_positions','owner_id'),('paper_positions','account_id'),('paper_positions','quantity'),('paper_positions','entry_price'),
  ('paper_orders','owner_id'),('paper_orders','client_order_id'),('paper_orders','position_id'),('paper_orders','fee'),
  ('audit_logs','owner_id'),('audit_logs','details')
 ) AS v(table_name,column_name)
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name=v.table_name AND c.column_name=v.column_name
 );
 IF missing IS NOT NULL THEN
   RAISE EXCEPTION 'Missing required columns: %',missing;
 END IF;
 RAISE NOTICE 'PASS: staging schema minimum preflight complete. This is not migration approval.';
END $$;
