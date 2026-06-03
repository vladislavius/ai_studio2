-- =============================================================================
-- ФИНАНСОВОЕ ПЛАНИРОВАНИЕ — схема таблиц Supabase
-- Прикладывается к существующей БД турфирмы (employees, statistics_*, ...)
-- =============================================================================

-- Недельные планы
create table if not exists fin_weekly_plans (
  id text primary key,
  week_start date not null,
  week_end date not null,
  status text not null check (status in ('draft','collecting','review','approved','executing','closed')),
  income_projected numeric default 0,
  income_actual numeric default 0,
  expense_projected numeric default 0,
  expense_actual numeric default 0,
  cash_on_hand_start numeric default 0,
  cash_on_hand_end numeric,
  solvency_ratio numeric,
  notes text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (week_start)
);
create index if not exists idx_fin_weekly_plans_week on fin_weekly_plans (week_start desc);

-- Прогноз дохода (по источникам)
create table if not exists fin_income_forecasts (
  id text primary key,
  plan_id text references fin_weekly_plans(id) on delete cascade,
  source text not null,
  description text,
  amount_projected numeric default 0,
  amount_actual numeric default 0,
  confidence text default 'medium' check (confidence in ('high','medium','low')),
  notes text
);
create index if not exists idx_fin_forecasts_plan on fin_income_forecasts (plan_id);

-- Заявки на расходы (бюджетные предложения)
create table if not exists fin_expense_proposals (
  id text primary key,
  plan_id text references fin_weekly_plans(id) on delete cascade,
  dept_id text not null,
  category text not null,
  title text not null,
  justification text,
  amount numeric not null default 0,
  priority text default 'normal' check (priority in ('critical','high','normal','low')),
  status text default 'proposed' check (status in ('proposed','reviewed','approved','rejected','paid')),
  proposer text,
  reviewed_by text,
  approved_by text,
  rejection_reason text,
  payment_date date,
  vendor text,
  is_recurring boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fin_proposals_plan on fin_expense_proposals (plan_id);
create index if not exists idx_fin_proposals_status on fin_expense_proposals (status);
create index if not exists idx_fin_proposals_dept on fin_expense_proposals (dept_id);

-- Резервные счета
create table if not exists fin_reserve_accounts (
  id text primary key,
  name text not null,
  type text not null check (type in ('operational','tax','growth','emergency','investment','payroll')),
  description text,
  balance numeric default 0,
  target_balance numeric,
  min_balance numeric,
  allocation_percent numeric,
  bank_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Банковские транзакции (для сверки)
create table if not exists fin_bank_transactions (
  id text primary key,
  plan_id text references fin_weekly_plans(id) on delete set null,
  date date not null,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null,
  category text,
  counterparty text,
  description text,
  account_id text references fin_reserve_accounts(id) on delete set null,
  reconciled boolean default false,
  bank_ref text,
  proposal_id text references fin_expense_proposals(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_fin_tx_date on fin_bank_transactions (date desc);
create index if not exists idx_fin_tx_plan on fin_bank_transactions (plan_id);

-- Снимки платёжеспособности
create table if not exists fin_solvency_snapshots (
  id text primary key,
  date date not null,
  cash_on_hand numeric default 0,
  accounts_receivable numeric default 0,
  accounts_payable numeric default 0,
  reserves_total numeric default 0,
  solvency_ratio numeric default 0,
  notes text
);
create index if not exists idx_fin_solvency_date on fin_solvency_snapshots (date desc);

-- RLS (по умолчанию открыто, можно ужесточить под нужды компании)
alter table fin_weekly_plans       enable row level security;
alter table fin_income_forecasts   enable row level security;
alter table fin_expense_proposals  enable row level security;
alter table fin_reserve_accounts   enable row level security;
alter table fin_bank_transactions  enable row level security;
alter table fin_solvency_snapshots enable row level security;

-- Базовые политики: всем аутентифицированным — чтение, запись.
-- В проде стоит ограничить запись только админами/финансовыми ролями.
do $$
begin
  for tbl in select unnest(array[
    'fin_weekly_plans','fin_income_forecasts','fin_expense_proposals',
    'fin_reserve_accounts','fin_bank_transactions','fin_solvency_snapshots'
  ]) loop
    execute format('drop policy if exists "auth_read"  on %I', tbl);
    execute format('drop policy if exists "auth_write" on %I', tbl);
    execute format('create policy "auth_read"  on %I for select using (auth.role() = ''authenticated'')', tbl);
    execute format('create policy "auth_write" on %I for all    using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', tbl);
  end loop;
end$$;
