-- Disposable CI-only verification of the first-trade marker trigger.
-- The full migration 0001 is tested on a dedicated schema with required columns.
CREATE SCHEMA auth;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE TABLE public.paper_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, quote_currency text DEFAULT 'USDT',
 initial_balance numeric NOT NULL, cash_balance numeric NOT NULL, first_trade_at timestamptz,
 status text DEFAULT 'active'
);
CREATE TABLE public.paper_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, account_id uuid NOT NULL,
 created_at timestamptz DEFAULT now()
);
CREATE TABLE public.paper_positions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, account_id uuid NOT NULL,
 created_at timestamptz DEFAULT now()
);
CREATE TABLE public.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid);
CREATE TABLE public.risk_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid);
CREATE TABLE public.portfolio_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid);
ALTER TABLE public.paper_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own paper acc update" ON public.paper_accounts FOR UPDATE TO authenticated USING (owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid());
INSERT INTO public.paper_accounts(owner_id,initial_balance,cash_balance)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,100);
