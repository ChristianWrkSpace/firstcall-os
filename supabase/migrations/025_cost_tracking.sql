-- Cost tracking — turn revenue-only Job Economics into a real P&L.
-- Adds the missing pieces: tech labor, consumables, vehicle expenses,
-- per-equipment daily cost, and a singleton settings row for default
-- hourly rate / van $/job / monthly overhead.

-- ─── Per-job tech labor entries ─────────────────────────────────────
create table if not exists public.tech_labor_entries (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  profile_id      uuid references public.profiles(id) on delete set null,
  work_date       date not null default current_date,
  hours           numeric(6,2) not null check (hours > 0),
  hourly_rate     numeric(8,2) not null check (hourly_rate >= 0),
  notes           text
);
create index if not exists idx_tech_labor_job on public.tech_labor_entries(job_id);
create index if not exists idx_tech_labor_date on public.tech_labor_entries(work_date desc);
alter table public.tech_labor_entries enable row level security;

-- ─── Per-job consumables ────────────────────────────────────────────
create table if not exists public.consumables_used (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  item            text not null,
  quantity        numeric(8,2) not null default 1 check (quantity > 0),
  unit_cost       numeric(8,2) not null check (unit_cost >= 0),
  notes           text
);
create index if not exists idx_consumables_job on public.consumables_used(job_id);
alter table public.consumables_used enable row level security;

-- ─── Equipment daily cost basis ─────────────────────────────────────
-- Per-piece daily depreciation/lease cost. NULL means "use the default
-- daily cost from cost_basis_settings".
alter table public.equipment add column if not exists daily_cost numeric(8,2);

-- ─── Vehicle / shared expenses (monthly recurring or one-off) ───────
create table if not exists public.vehicle_expenses (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  expense_date    date not null default current_date,
  category        text not null check (category in (
    'fuel','maintenance','insurance','lease','registration','tolls','parking','other'
  )),
  amount          numeric(10,2) not null check (amount >= 0),
  vehicle_id      text,
  notes           text
);
create index if not exists idx_vehicle_exp_date on public.vehicle_expenses(expense_date desc);
alter table public.vehicle_expenses enable row level security;

-- ─── Cost basis settings (singleton row, id=1) ──────────────────────
create table if not exists public.cost_basis_settings (
  id                       int primary key default 1,
  default_hourly_rate      numeric(8,2) not null default 35.00,
  van_cost_per_job         numeric(8,2) not null default 75.00,
  monthly_overhead         numeric(10,2) not null default 8000.00,
  default_equipment_daily  numeric(8,2) not null default 25.00,
  updated_at               timestamptz default now(),
  check (id = 1)
);
insert into public.cost_basis_settings (id) values (1) on conflict do nothing;
alter table public.cost_basis_settings enable row level security;

-- ─── RLS policies (idempotent) ──────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='tech_labor_entries' and policyname='auth all tech labor'
  ) then
    create policy "auth all tech labor"
      on public.tech_labor_entries for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename='consumables_used' and policyname='auth all consumables'
  ) then
    create policy "auth all consumables"
      on public.consumables_used for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename='vehicle_expenses' and policyname='auth all vehicle exp'
  ) then
    create policy "auth all vehicle exp"
      on public.vehicle_expenses for all
      using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename='cost_basis_settings' and policyname='auth all cost basis'
  ) then
    create policy "auth all cost basis"
      on public.cost_basis_settings for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
