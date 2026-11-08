-- Paper account integrity: the authenticated user may set the opening balance
-- only before the first simulated order/position. The trading engine (service_role)
-- remains the only writer for operational balances, trades, and audit events.

CREATE OR REPLACE FUNCTION public.paper_account_has_activity(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.paper_orders
      WHERE account_id = p_account_id
        AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.paper_positions
      WHERE account_id = p_account_id
        AND owner_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.paper_account_has_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paper_account_has_activity(uuid) TO authenticated;

-- Serialize the first simulated trade against any opening-balance edit.
CREATE OR REPLACE FUNCTION public.lock_paper_account_for_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_owner uuid;
BEGIN
  SELECT owner_id
    INTO v_account_owner
    FROM public.paper_accounts
   WHERE id = NEW.account_id
   FOR UPDATE;

  IF NOT FOUND OR v_account_owner IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Paper trade account does not belong to the supplied owner';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_paper_account_for_trade() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_lock_paper_account_before_order
BEFORE INSERT ON public.paper_orders
FOR EACH ROW EXECUTE FUNCTION public.lock_paper_account_for_trade();

CREATE TRIGGER trg_lock_paper_account_before_position
BEFORE INSERT ON public.paper_positions
FOR EACH ROW EXECUTE FUNCTION public.lock_paper_account_for_trade();

-- Enforce the first-operation rule again inside the row update, after the account
-- row lock has been acquired. This closes the race with a simultaneous first trade.
CREATE OR REPLACE FUNCTION public.guard_paper_account_initial_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND NEW.initial_balance IS DISTINCT FROM OLD.initial_balance THEN
    IF EXISTS (
      SELECT 1 FROM public.paper_orders
      WHERE account_id = OLD.id AND owner_id = OLD.owner_id
    ) OR EXISTS (
      SELECT 1 FROM public.paper_positions
      WHERE account_id = OLD.id AND owner_id = OLD.owner_id
    ) THEN
      RAISE EXCEPTION 'Opening balance cannot be changed after the first paper trade';
    END IF;

    -- Before the first trade, available cash must equal the chosen opening balance.
    NEW.cash_balance := NEW.initial_balance;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_paper_account_initial_balance() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_paper_account_initial_balance
BEFORE UPDATE ON public.paper_accounts
FOR EACH ROW EXECUTE FUNCTION public.guard_paper_account_initial_balance();

-- Replace broad table privileges with column-scoped opening-balance permissions.
REVOKE INSERT, UPDATE ON public.paper_accounts FROM PUBLIC, anon, authenticated;
GRANT INSERT (owner_id, quote_currency) ON public.paper_accounts TO authenticated;
GRANT UPDATE (initial_balance) ON public.paper_accounts TO authenticated;

DROP POLICY IF EXISTS "own paper acc update" ON public.paper_accounts;
CREATE POLICY "own paper acc opening balance before activity"
ON public.paper_accounts
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  AND NOT public.paper_account_has_activity(id)
)
WITH CHECK (
  owner_id = auth.uid()
  AND NOT public.paper_account_has_activity(id)
);

-- Audit and risk-event rows are engine-owned append-only records.
REVOKE INSERT ON public.audit_logs FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.risk_events FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "own audit insert" ON public.audit_logs;
DROP POLICY IF EXISTS "own risk events insert" ON public.risk_events;
