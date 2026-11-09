-- GitHub Actions ONLY: synthetic Supabase Auth stand-in on a throwaway PostgreSQL.
-- NEVER execute on a deployed Supabase / Lovable database.
-- No real user, password, JWT, exchange credentials, or balance is used.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION auth.role()
RETURNS text LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;

GRANT EXECUTE ON FUNCTION auth.uid(), auth.role()
TO anon, authenticated, service_role;
