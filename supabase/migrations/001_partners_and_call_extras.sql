-- Partners: plumbers, adjusters, and other referral sources
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,
  company    text,
  phone      text,
  email      text,
  notes      text,
  active     boolean default true
);

alter table public.partners enable row level security;

create policy "authenticated read partners"
  on public.partners for all
  using (auth.role() = 'authenticated');

-- Link jobs to referring partners
alter table public.jobs
  add column if not exists referred_by_id uuid references public.partners(id) on delete set null;

create index if not exists idx_jobs_referred_by on public.jobs(referred_by_id);
