-- Job photos for Argus AI scoping
create table if not exists public.job_photos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  caption      text
);

create index if not exists idx_job_photos_job_id on public.job_photos(job_id);
alter table public.job_photos enable row level security;
create policy "authenticated all job_photos" on public.job_photos for all using (auth.role() = 'authenticated');

-- Argus scope assessment stored on the job
alter table public.jobs add column if not exists scope_assessment jsonb;
alter table public.jobs add column if not exists scope_analyzed_at timestamptz;
