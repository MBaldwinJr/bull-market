-- PostgreSQL 16 disposable fixture only. These checks mirror production constraints
-- observed via read-only information_schema/pg_constraint inspection.
ALTER TABLE public.paper_accounts
  ADD CONSTRAINT paper_accounts_cash_balance_check CHECK (cash_balance >= 0),
  ADD CONSTRAINT paper_accounts_initial_balance_check CHECK (initial_balance >= 0),
  ADD CONSTRAINT paper_accounts_owner_id_key UNIQUE (owner_id);
ALTER TABLE public.bot_config
  ADD CONSTRAINT bot_config_live_trading_enabled_check CHECK (live_trading_enabled = false),
  ADD CONSTRAINT bot_config_allow_withdrawals_check CHECK (allow_withdrawals = false);
ALTER TABLE public.risk_limits
  ADD CONSTRAINT risk_limits_leverage_check CHECK (leverage = 0),
  ADD CONSTRAINT risk_limits_stop_loss_required_check CHECK (stop_loss_required = true),
  ADD CONSTRAINT risk_limits_max_risk_per_trade_pct_check CHECK (max_risk_per_trade_pct > 0 AND max_risk_per_trade_pct <= 2),
  ADD CONSTRAINT risk_limits_max_daily_loss_pct_check CHECK (max_daily_loss_pct > 0 AND max_daily_loss_pct <= 5),
  ADD CONSTRAINT risk_limits_max_open_positions_check CHECK (max_open_positions BETWEEN 1 AND 10);
ALTER TABLE public.paper_positions
  ADD CONSTRAINT paper_positions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT paper_positions_quantity_check CHECK (quantity > 0),
  ADD CONSTRAINT paper_positions_entry_price_check CHECK (entry_price > 0),
  ADD CONSTRAINT paper_positions_stop_loss_check CHECK (stop_loss > 0),
  ADD CONSTRAINT paper_positions_side_check CHECK (side='long'),
  ADD CONSTRAINT paper_positions_status_check CHECK (status IN ('open','closed'));
ALTER TABLE public.paper_orders
  ADD CONSTRAINT paper_orders_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.paper_accounts(id) ON DELETE CASCADE,
  ADD CONSTRAINT paper_orders_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.paper_positions(id) ON DELETE SET NULL,
  ADD CONSTRAINT paper_orders_quantity_check CHECK (quantity > 0),
  ADD CONSTRAINT paper_orders_side_check CHECK (side IN ('buy','sell')),
  ADD CONSTRAINT paper_orders_order_type_check CHECK (order_type IN ('market','limit')),
  ADD CONSTRAINT paper_orders_status_check CHECK (status IN ('pending','filled','cancelled','rejected'));
