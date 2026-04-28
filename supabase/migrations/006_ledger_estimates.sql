-- Ledger — Estimating
-- Convert Argus scope into Xactimate-style line items with HITL approval.

create table if not exists public.estimates (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  version        integer not null default 1,
  status         text not null default 'draft' check (status in ('draft','approved','sent','rejected','revised')),
  notes          text,
  generated_by   uuid references public.profiles(id) on delete set null,
  approved_by    uuid references public.profiles(id) on delete set null,
  approved_at    timestamptz,
  sent_to        text,
  sent_at        timestamptz,
  generation_meta jsonb default '{}'
);
create index if not exists idx_estimates_job on public.estimates(job_id);
create index if not exists idx_estimates_status on public.estimates(status);
alter table public.estimates enable row level security;

create table if not exists public.estimate_line_items (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  estimate_id    uuid not null references public.estimates(id) on delete cascade,
  sort_order     integer not null default 0,
  category       text,
  xactimate_code text,
  description    text not null,
  quantity       numeric(10,2) not null default 1,
  unit           text not null default 'EA',
  unit_price     numeric(10,2) not null default 0,
  line_total     numeric(12,2) generated always as (quantity * unit_price) stored,
  notes          text,
  is_ai_drafted  boolean default true
);
create index if not exists idx_line_items_estimate on public.estimate_line_items(estimate_id);
alter table public.estimate_line_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='estimates' and policyname='auth all estimates') then
    create policy "auth all estimates" on public.estimates for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='estimate_line_items' and policyname='auth all line items') then
    create policy "auth all line items" on public.estimate_line_items for all using (auth.role() = 'authenticated');
  end if;
end $$;
