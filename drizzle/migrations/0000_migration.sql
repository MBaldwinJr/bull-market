
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- bot_config: live trading locked by constraints
create table public.bot_config (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  trading_mode text not null default 'paper' check (trading_mode in ('paper','testnet')),
  live_trading_enabled boolean not null default false check (live_trading_enabled = false),
  binance_testnet boolean not null default true check (binance_testnet = true),
  allow_withdrawals boolean not null default false check (allow_withdrawals = false),
  status text not null default 'stopped' check (status in ('stopped','running','emergency_stopped')),
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.bot_config to authenticated;
grant all on public.bot_config to service_role;
alter table public.bot_config enable row level security;
create policy "own bot select" on public.bot_config for select to authenticated using (owner_id = auth.uid());
create policy "own bot insert" on public.bot_config for insert to authenticated with check (owner_id = auth.uid());
create policy "own bot update" on public.bot_config for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger trg_bot_updated before update on public.bot_config for each row execute function public.set_updated_at();

-- risk_limits (percent stored as numeric)
create table public.risk_limits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  max_risk_per_trade_pct numeric(6,3) not null default 0.5 check (max_risk_per_trade_pct > 0 and max_risk_per_trade_pct <= 2),
  max_daily_loss_pct numeric(6,3) not null default 1 check (max_daily_loss_pct > 0 and max_daily_loss_pct <= 5),
  max_open_positions int not null default 2 check (max_open_positions between 1 and 10),
  leverage int not null default 0 check (leverage = 0),
  stop_loss_required boolean not null default true check (stop_loss_required = true),
  take_profit_pct numeric(6,3),
  status text not null default 'active',
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.risk_limits to authenticated;
grant all on public.risk_limits to service_role;
alter table public.risk_limits enable row level security;
create policy "own risk select" on public.risk_limits for select to authenticated using (owner_id = auth.uid());
create policy "own risk insert" on public.risk_limits for insert to authenticated with check (owner_id = auth.uid());
create policy "own risk update" on public.risk_limits for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger trg_risk_updated before update on public.risk_limits for each row execute function public.set_updated_at();

-- watched assets
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,20}$'),
  base_asset text not null,
  quote_asset text not null,
  auto_trade_enabled boolean not null default false,
  status text not null default 'active',
  source text not null default 'binance_spot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, symbol)
);
create index idx_assets_owner on public.assets(owner_id) where deleted_at is null;
grant select, insert, update, delete on public.assets to authenticated;
grant all on public.assets to service_role;
alter table public.assets enable row level security;
create policy "own assets all" on public.assets for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger trg_assets_updated before update on public.assets for each row execute function public.set_updated_at();

-- paper accounts
create table public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  initial_balance numeric(20,8) not null default 0 check (initial_balance >= 0),
  cash_balance numeric(20,8) not null default 0 check (cash_balance >= 0),
  quote_currency text not null default 'USDT',
  status text not null default 'active',
  source text not null default 'paper',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.paper_accounts to authenticated;
grant all on public.paper_accounts to service_role;
alter table public.paper_accounts enable row level security;
create policy "own paper acc select" on public.paper_accounts for select to authenticated using (owner_id = auth.uid());
create policy "own paper acc insert" on public.paper_accounts for insert to authenticated with check (owner_id = auth.uid());
create policy "own paper acc update" on public.paper_accounts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger trg_paper_acc_updated before update on public.paper_accounts for each row execute function public.set_updated_at();

-- paper positions
create table public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  symbol text not null,
  side text not null default 'long' check (side = 'long'),
  quantity numeric(28,10) not null check (quantity > 0),
  entry_price numeric(20,8) not null check (entry_price > 0),
  stop_loss numeric(20,8) not null check (stop_loss > 0),
  take_profit numeric(20,8),
  exit_price numeric(20,8),
  fees_paid numeric(20,8) not null default 0,
  realized_pnl numeric(20,8),
  strategy_key text,
  status text not null default 'open' check (status in ('open','closed')),
  source text not null default 'paper',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_paper_pos_owner on public.paper_positions(owner_id, status);
grant select on public.paper_positions to authenticated;
grant all on public.paper_positions to service_role;
alter table public.paper_positions enable row level security;
create policy "own paper pos select" on public.paper_positions for select to authenticated using (owner_id = auth.uid());
create trigger trg_paper_pos_updated before update on public.paper_positions for each row execute function public.set_updated_at();

-- paper orders (idempotent via client_order_id)
create table public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  account_id uuid not null references public.paper_accounts(id) on delete cascade,
  position_id uuid references public.paper_positions(id) on delete set null,
  client_order_id text not null,
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  order_type text not null check (order_type in ('market','limit')),
  quantity numeric(28,10) not null check (quantity > 0),
  requested_price numeric(20,8),
  executed_price numeric(20,8),
  fee numeric(20,8) not null default 0,
  slippage numeric(20,8) not null default 0,
  status text not null default 'filled' check (status in ('pending','filled','cancelled','rejected')),
  source text not null default 'paper',
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_order_id)
);
create index idx_paper_orders_owner on public.paper_orders(owner_id, created_at desc);
grant select on public.paper_orders to authenticated;
grant all on public.paper_orders to service_role;
alter table public.paper_orders enable row level security;
create policy "own paper orders select" on public.paper_orders for select to authenticated using (owner_id = auth.uid());
create trigger trg_paper_orders_updated before update on public.paper_orders for each row execute function public.set_updated_at();

-- portfolio snapshots
create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  equity numeric(20,8) not null,
  cash numeric(20,8) not null,
  unrealized_pnl numeric(20,8) not null default 0,
  realized_pnl numeric(20,8) not null default 0,
  source text not null default 'paper',
  status text not null default 'final',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_snap_owner on public.portfolio_snapshots(owner_id, captured_at);
grant select on public.portfolio_snapshots to authenticated;
grant all on public.portfolio_snapshots to service_role;
alter table public.portfolio_snapshots enable row level security;
create policy "own snaps select" on public.portfolio_snapshots for select to authenticated using (owner_id = auth.uid());

-- risk events + audit logs (append-only for users)
create table public.risk_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'logged',
  source text not null default 'risk_engine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_risk_events_owner on public.risk_events(owner_id, created_at desc);
grant select, insert on public.risk_events to authenticated;
grant all on public.risk_events to service_role;
alter table public.risk_events enable row level security;
create policy "own risk events select" on public.risk_events for select to authenticated using (owner_id = auth.uid());
create policy "own risk events insert" on public.risk_events for insert to authenticated with check (owner_id = auth.uid());

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  action text not null,
  entity text,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'ok',
  source text not null default 'frontend',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_audit_owner on public.audit_logs(owner_id, created_at desc);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "own audit select" on public.audit_logs for select to authenticated using (owner_id = auth.uid());
create policy "own audit insert" on public.audit_logs for insert to authenticated with check (owner_id = auth.uid());

-- strategies
create table public.trading_strategies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  strategy_key text not null check (strategy_key in ('trend_following','ema','rsi','macd','vwap','breakout','atr')),
  name text not null,
  enabled boolean not null default false,
  weight int not null default 0 check (weight between 0 and 100),
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, strategy_key)
);
grant select, insert, update on public.trading_strategies to authenticated;
grant all on public.trading_strategies to service_role;
alter table public.trading_strategies enable row level security;
create policy "own strat all" on public.trading_strategies for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger trg_strat_updated before update on public.trading_strategies for each row execute function public.set_updated_at();

-- signup bootstrap
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.bot_config(owner_id) values (new.id);
  insert into public.risk_limits(owner_id) values (new.id);
  insert into public.paper_accounts(owner_id) values (new.id);
  insert into public.assets(owner_id, symbol, base_asset, quote_asset) values
    (new.id,'BTCUSDT','BTC','USDT'),(new.id,'ETHUSDT','ETH','USDT'),(new.id,'BNBUSDT','BNB','USDT'),
    (new.id,'SOLUSDT','SOL','USDT'),(new.id,'USDCUSDT','USDC','USDT');
  insert into public.trading_strategies(owner_id, strategy_key, name, weight, parameters) values
    (new.id,'trend_following','Trend Following',30,'{}'),
    (new.id,'ema','EMA 9/21/200',0,'{"fast":9,"mid":21,"slow":200}'),
    (new.id,'rsi','RSI',25,'{"period":14,"overbought":70,"oversold":30}'),
    (new.id,'macd','MACD',0,'{"fast":12,"slow":26,"signal":9}'),
    (new.id,'vwap','VWAP',20,'{}'),
    (new.id,'breakout','Breakout',10,'{"lookback":20}'),
    (new.id,'atr','ATR',15,'{"period":14,"stop_multiplier":2}');
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
