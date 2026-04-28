-- ============================================================
-- FirstCall OS — Database Schema
-- ============================================================

-- profiles: extends auth.users with app-specific fields
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  name        text not null,
  email       text,
  phone       text,
  role        text not null default 'technician'
                check (role in ('owner', 'manager', 'technician', 'office')),
  avatar_url  text,
  active      boolean default true
);

-- customers: people or companies who hire First Call
create table if not exists public.customers (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz default now(),
  name                    text not null,
  email                   text,
  phone                   text,
  address                 text,
  city                    text,
  state                   text default 'TX',
  zip                     text,
  insurance_company       text,
  insurance_policy_number text,
  insurance_claim_number  text,
  notes                   text
);

-- jobs: the core unit of work
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  job_number      text unique,
  customer_id     uuid references public.customers(id) on delete set null,
  status          text not null default 'lead'
                    check (status in ('lead', 'inspection', 'mitigation', 'drying', 'reconstruction', 'completed', 'cancelled')),
  type            text default 'water'
                    check (type in ('water', 'fire', 'mold', 'storm', 'other')),
  description     text,
  site_address    text,
  site_city       text,
  site_state      text default 'TX',
  site_zip        text,
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  estimated_value numeric(10, 2),
  lead_tech_id    uuid references public.profiles(id) on delete set null
);

-- job_assignments: which techs are on which jobs
create table if not exists public.job_assignments (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (job_id, profile_id)
);

-- job_notes: timestamped notes, call transcripts, AI summaries
create table if not exists public.job_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  type        text not null default 'note'
                check (type in ('note', 'call_transcript', 'ai_summary', 'status_change')),
  content     text not null,
  metadata    jsonb default '{}'
);

-- calls: inbound/outbound calls with Deepgram transcription
create table if not exists public.calls (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  customer_id       uuid references public.customers(id) on delete set null,
  job_id            uuid references public.jobs(id) on delete set null,
  direction         text default 'inbound' check (direction in ('inbound', 'outbound')),
  duration_seconds  integer,
  from_number       text,
  to_number         text,
  recording_url     text,
  transcript        text,
  ai_summary        text,
  deepgram_response jsonb default '{}'
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_jobs_customer_id   on public.jobs(customer_id);
create index if not exists idx_jobs_status        on public.jobs(status);
create index if not exists idx_jobs_created_at    on public.jobs(created_at desc);
create index if not exists idx_job_notes_job_id   on public.job_notes(job_id);
create index if not exists idx_calls_job_id       on public.calls(job_id);
create index if not exists idx_calls_customer_id  on public.calls(customer_id);

-- ============================================================
-- Auto-update updated_at on jobs
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ============================================================
-- Auto-generate job numbers: FCM-YYYYMM-NNNN
-- ============================================================
create sequence if not exists public.job_number_seq;

create or replace function public.generate_job_number()
returns trigger language plpgsql as $$
begin
  new.job_number = 'FCM-' || to_char(now(), 'YYYYMM') || '-' ||
                   lpad(nextval('public.job_number_seq')::text, 4, '0');
  return new;
end;
$$;

create or replace trigger jobs_generate_number
  before insert on public.jobs
  for each row
  when (new.job_number is null)
  execute function public.generate_job_number();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.customers       enable row level security;
alter table public.jobs            enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_notes       enable row level security;
alter table public.calls           enable row level security;

-- Authenticated users can read/write all rows (tighten per-role later)
create policy "authenticated read profiles"        on public.profiles        for select using (auth.role() = 'authenticated');
create policy "authenticated read customers"       on public.customers       for all    using (auth.role() = 'authenticated');
create policy "authenticated read jobs"            on public.jobs            for all    using (auth.role() = 'authenticated');
create policy "authenticated read job_assignments" on public.job_assignments for all    using (auth.role() = 'authenticated');
create policy "authenticated read job_notes"       on public.job_notes       for all    using (auth.role() = 'authenticated');
create policy "authenticated read calls"           on public.calls           for all    using (auth.role() = 'authenticated');

-- Users can update their own profile
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);
