-- Partner referral & ROI tracking.
-- Two append-only investment ledgers per partner:
--   * partner_payouts        — actual cash referral fees (1099 territory)
--   * partner_investments    — soft investments (gifts, meals, marketing)
-- Plus partner_type so we can hide payout/investment UI for insurance
-- adjusters (TX § 4102.158 prohibits paying value for claim referrals).

alter table public.partners
  add column if not exists partner_type text default 'other' check (partner_type in (
    'plumber',
    'property_manager',
    'hotel',
    'restaurant',
    'medical_facility',
    'school',
    'retail',
    'office_building',
    'general_contractor',
    'insurance_office',
    'insurance_adjuster',
    'other'
  ));

create table if not exists public.partner_payouts (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  job_id          uuid references public.jobs(id) on delete set null,
  occurred_on     date not null default current_date,
  amount          numeric(10,2) not null check (amount > 0),
  method          text check (method in ('check','ach','cash','venmo','zelle','other')),
  reference       text,
  notes           text,
  recorded_by     uuid references public.profiles(id) on delete set null
);
create index if not exists idx_partner_payouts_partner on public.partner_payouts(partner_id);
create index if not exists idx_partner_payouts_job on public.partner_payouts(job_id);
alter table public.partner_payouts enable row level security;

create table if not exists public.partner_investments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  occurred_on     date not null default current_date,
  amount          numeric(10,2) not null check (amount >= 0),
  category        text not null check (category in (
    'gift', 'meal', 'event', 'marketing_coop', 'training', 'other'
  )),
  notes           text,
  recorded_by     uuid references public.profiles(id) on delete set null
);
create index if not exists idx_partner_investments_partner on public.partner_investments(partner_id);
alter table public.partner_investments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='partner_payouts' and policyname='auth all partner payouts') then
    create policy "auth all partner payouts" on public.partner_payouts
      for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='partner_investments' and policyname='auth all partner investments') then
    create policy "auth all partner investments" on public.partner_investments
      for all using (auth.role() = 'authenticated');
  end if;
end $$;
