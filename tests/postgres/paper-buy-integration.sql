-- Runs exclusively against the disposable CI database.
DO $$
DECLARE
  owner uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  order_id uuid;
  before_cash numeric;
  after_cash numeric;
  failed boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  failed := false;
  BEGIN
    PERFORM public.execute_paper_buy(owner,'test-order-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Authenticated role was allowed'; END IF;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  SELECT cash_balance INTO before_cash FROM public.paper_accounts WHERE owner_id=owner;
  failed := false;
  BEGIN
    PERFORM public.execute_paper_buy(owner,'test-order-stale','BTCUSDT','ema',1,50,49.75,0.001,now()-interval '1 minute');
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Stale quote was accepted'; END IF;
  IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) <> before_cash THEN RAISE EXCEPTION 'Rejected order changed cash'; END IF;
  order_id := public.execute_paper_buy(owner,'test-order-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
  SELECT cash_balance INTO after_cash FROM public.paper_accounts WHERE owner_id=owner;
  IF after_cash <> 49.95 THEN RAISE EXCEPTION 'Incorrect cash after buy: %',after_cash; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.paper_orders o
    JOIN public.paper_positions p ON p.id=o.position_id
    WHERE o.id=order_id AND o.owner_id=owner AND p.owner_id=owner
      AND o.client_order_id='test-order-0001'
      AND o.quantity=1 AND p.quantity=1 AND p.entry_price=50
      AND o.requested_price=50 AND o.executed_price=50
      AND o.fee=0.05 AND p.fees_paid=0.05
      AND o.account_id=p.account_id
      AND o.side='buy' AND p.side='long'
      AND o.status='filled' AND p.status='open'
  ) THEN RAISE EXCEPTION 'Order and position ledger do not reconcile'; END IF;
  IF (SELECT count(*) FROM public.paper_orders WHERE id=order_id) <> 1 OR
     (SELECT count(*) FROM public.paper_positions WHERE owner_id=owner) <> 1 OR
     (SELECT count(*) FROM public.audit_logs WHERE owner_id=owner) <> 1
  THEN RAISE EXCEPTION 'Incomplete atomic order'; END IF;
  failed := false;
  BEGIN
    PERFORM public.execute_paper_buy(owner,'test-order-0001','BTCUSDT','ema',1,50,49.75,0.001,now());
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Duplicate order was accepted'; END IF;
  IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) <> after_cash THEN RAISE EXCEPTION 'Duplicate changed cash'; END IF;
  UPDATE public.bot_config SET live_trading_enabled=NULL WHERE owner_id=owner;
  failed := false;
  BEGIN
    PERFORM public.execute_paper_buy(owner,'test-order-0002','BTCUSDT','ema',0.1,50,49.75,0.001,now());
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'NULL safety flag was accepted'; END IF;
  IF (SELECT cash_balance FROM public.paper_accounts WHERE owner_id=owner) <> after_cash THEN RAISE EXCEPTION 'Rejected order changed cash'; END IF;
END $$;
