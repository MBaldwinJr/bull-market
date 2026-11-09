-- Disposable PostgreSQL-only fixture. NEVER run against Lovable Cloud.
CREATE SCHEMA auth;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
CREATE TABLE public.paper_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, initial_balance numeric NOT NULL, cash_balance numeric NOT NULL, status text NOT NULL DEFAULT 'active', first_trade_at timestamptz, updated_at timestamptz DEFAULT now());
CREATE TABLE public.bot_config (owner_id uuid PRIMARY KEY, trading_mode text, live_trading_enabled boolean, allow_withdrawals boolean, status text);
CREATE TABLE public.risk_limits (owner_id uuid PRIMARY KEY, leverage numeric, max_risk_per_trade_pct numeric, max_daily_loss_pct numeric, max_open_positions integer);
CREATE TABLE public.assets (owner_id uuid, symbol text, auto_trade_enabled boolean, deleted_at timestamptz, status text);
CREATE TABLE public.trading_strategies (owner_id uuid, strategy_key text, enabled boolean);
CREATE TABLE public.paper_positions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, account_id uuid, symbol text, side text, quantity numeric, entry_price numeric, stop_loss numeric, fees_paid numeric, strategy_key text, status text, source text, closed_at timestamptz, realized_pnl numeric);
CREATE TABLE public.paper_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid, account_id uuid, position_id uuid, client_order_id text, symbol text, side text, order_type text, quantity numeric, requested_price numeric, executed_price numeric, fee numeric, status text, source text, executed_at timestamptz, UNIQUE(owner_id,client_order_id));
CREATE TABLE public.audit_logs (owner_id uuid, action text, entity text, details jsonb, status text, source text);
INSERT INTO public.paper_accounts(owner_id,initial_balance,cash_balance) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,100);
INSERT INTO public.bot_config VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','paper',false,false,'running');
INSERT INTO public.risk_limits VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,0.5,1,2);
INSERT INTO public.assets VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','BTCUSDT',true,NULL,'active');
INSERT INTO public.trading_strategies VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test_strategy',true);
