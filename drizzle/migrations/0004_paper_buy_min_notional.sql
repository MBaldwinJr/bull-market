-- Migration 0004: minimum 5 USDT notional inside the existing atomic paper BUY.
-- Strictly code-only until explicitly authorized for the real database.
-- Replaces ONLY the existing execute_paper_buy function; preserves its signature,
-- paper-only controls, owner lock, risk gates, ledger writes, and role ACL.
-- A single transaction preserves grant safety if replacement fails.
BEGIN;
-- Server-only, atomic paper BUY. Deploy after review; no trades are executed by this migration.
-- Caller must be a trusted backend using service_role; never expose its key in the browser.
CREATE OR REPLACE FUNCTION public.execute_paper_buy(
  p_owner_id uuid,
  p_client_order_id text,
  p_symbol text,
  p_strategy_key text,
  p_quantity numeric,
  p_entry_price numeric,
  p_stop_loss numeric,
  p_fee_rate numeric,
  p_quote_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.paper_accounts%ROWTYPE;
  v_bot public.bot_config%ROWTYPE;
  v_limits public.risk_limits%ROWTYPE;
  v_position_id uuid;
  v_order_id uuid;
  v_notional numeric;
  v_fee numeric;
  v_open integer;
  v_daily_pnl numeric;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the backend may execute paper orders';
  END IF;
  IF p_owner_id IS NULL OR p_client_order_id IS NULL OR length(p_client_order_id) NOT BETWEEN 8 AND 128
     OR p_symbol IS NULL OR p_symbol !~ '^[A-Z0-9]{2,20}$' OR p_strategy_key IS NULL OR length(trim(p_strategy_key)) = 0
     OR p_quantity IS NULL OR p_entry_price IS NULL OR p_stop_loss IS NULL OR p_fee_rate IS NULL
     OR p_quantity <= 0 OR p_entry_price <= 0 OR p_stop_loss <= 0 OR p_stop_loss >= p_entry_price
     OR p_fee_rate < 0 OR p_fee_rate > 0.01
     OR p_quote_at IS NULL OR p_quote_at > now() + interval '5 seconds'
     OR p_quote_at < now() - interval '30 seconds'
  THEN RAISE EXCEPTION 'Invalid or stale paper entry'; END IF;

  SELECT * INTO STRICT v_account FROM public.paper_accounts
   WHERE owner_id = p_owner_id AND status = 'active' AND source = 'paper' FOR UPDATE;
  SELECT * INTO STRICT v_bot FROM public.bot_config WHERE owner_id = p_owner_id;
  SELECT * INTO STRICT v_limits FROM public.risk_limits WHERE owner_id = p_owner_id;
  IF v_bot.trading_mode IS DISTINCT FROM 'paper' OR v_bot.live_trading_enabled IS DISTINCT FROM false OR v_bot.allow_withdrawals IS DISTINCT FROM false
     OR v_bot.status IS DISTINCT FROM 'running' OR v_limits.status IS DISTINCT FROM 'active' OR v_limits.stop_loss_required IS DISTINCT FROM true OR v_limits.leverage IS DISTINCT FROM 0
     OR (v_limits.max_risk_per_trade_pct BETWEEN 0.001 AND 2) IS DISTINCT FROM true
     OR (v_limits.max_daily_loss_pct BETWEEN 0.001 AND 5) IS DISTINCT FROM true
     OR (v_limits.max_open_positions >= 1) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'Paper execution disabled by safety settings'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE owner_id=p_owner_id
     AND symbol=p_symbol AND auto_trade_enabled IS TRUE AND deleted_at IS NULL AND status='active')
     OR NOT EXISTS (SELECT 1 FROM public.trading_strategies WHERE owner_id=p_owner_id
     AND strategy_key=p_strategy_key AND enabled IS TRUE AND status='active')
  THEN RAISE EXCEPTION 'Asset or strategy not enabled'; END IF;

  -- Idempotency is checked under the serialized account lock.
  SELECT id INTO v_order_id FROM public.paper_orders
    WHERE owner_id=p_owner_id AND client_order_id=p_client_order_id;
  IF FOUND THEN RAISE EXCEPTION 'Duplicate client order id'; END IF;
  SELECT count(*) INTO v_open FROM public.paper_positions
    WHERE account_id=v_account.id AND status='open';
  IF v_open >= v_limits.max_open_positions THEN RAISE EXCEPTION 'Position limit reached'; END IF;
  SELECT coalesce(sum(realized_pnl),0) INTO v_daily_pnl FROM public.paper_positions
    WHERE account_id=v_account.id AND status='closed' AND closed_at >= date_trunc('day',now());
  IF -v_daily_pnl >= v_account.initial_balance*v_limits.max_daily_loss_pct/100
  THEN RAISE EXCEPTION 'Daily loss limit reached'; END IF;
  v_notional := p_quantity*p_entry_price;
  -- Internal Paper Trading simulator policy, not an exchange lot-size rule.
  -- Keep this guard inside the account lock and before ANY balance/order writes.
  IF v_notional < 5 THEN
    RAISE EXCEPTION 'Paper buy notional below 5 USDT';
  END IF;
  v_fee := v_notional*p_fee_rate;
  IF v_account.cash_balance IS NULL OR v_account.initial_balance IS NULL
     OR v_account.cash_balance <= 0 OR v_account.initial_balance <= 0
     OR v_notional + v_fee > v_account.cash_balance
     OR p_quantity*(p_entry_price-p_stop_loss) > v_account.initial_balance*v_limits.max_risk_per_trade_pct/100
  THEN RAISE EXCEPTION 'Insufficient cash or risk limit exceeded'; END IF;

  UPDATE public.paper_accounts SET cash_balance=cash_balance-v_notional-v_fee, updated_at=now()
    WHERE id=v_account.id;
  INSERT INTO public.paper_positions
    (owner_id,account_id,symbol,side,quantity,entry_price,stop_loss,fees_paid,strategy_key,status,source)
    VALUES (p_owner_id,v_account.id,p_symbol,'long',p_quantity,p_entry_price,p_stop_loss,v_fee,p_strategy_key,'open','paper')
    RETURNING id INTO v_position_id;
  INSERT INTO public.paper_orders
    (owner_id,account_id,position_id,client_order_id,symbol,side,order_type,quantity,requested_price,executed_price,fee,status,source,executed_at)
    VALUES (p_owner_id,v_account.id,v_position_id,p_client_order_id,p_symbol,'buy','market',p_quantity,p_entry_price,p_entry_price,v_fee,'filled','paper',now())
    RETURNING id INTO v_order_id;
  INSERT INTO public.audit_logs(owner_id,action,entity,details,status,source)
    VALUES (p_owner_id,'paper_buy','paper_orders',
      jsonb_build_object('order_id',v_order_id,'position_id',v_position_id,'symbol',p_symbol,'quantity',p_quantity,'price',p_entry_price,'fee',v_fee),
      'success','paper');
  RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.execute_paper_buy(uuid,text,text,text,numeric,numeric,numeric,numeric,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_paper_buy(uuid,text,text,text,numeric,numeric,numeric,numeric,timestamptz) TO service_role;

COMMIT;
