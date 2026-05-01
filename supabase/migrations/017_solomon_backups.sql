-- Solomon (FP&A reports) + Backups (run history)

create table if not exists public.solomon_reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  generated_by    uuid references public.profiles(id) on delete set null,
  window_days     int not null default 90,
  job_count       int default 0,
  invoice_count   int default 0,
  total_billed    numeric(12,2) default 0,
  total_collected numeric(12,2) default 0,
  insights        jsonb,
  recommendations jsonb,
  raw_summary     text
);
create index if not exists idx_solomon_created on public.solomon_reports(created_at desc);
alter table public.solomon_reports enable row level security;

create table if not exists public.backups_log (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  triggered_by    text not null check (triggered_by in ('cron','manual')),
  triggered_user  uuid references public.profiles(id) on delete set null,
  status          text not null default 'running' check (status in ('running','ok','failed')),
  storage_path    text,
  bytes           bigint,
  row_counts      jsonb,
  error           text,
  finished_at     timestamptz
);
create index if not exists idx_backups_created on public.backups_log(created_at desc);
alter table public.backups_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='solomon_reports' and policyname='auth all solomon') then
    create policy "auth all solomon" on public.solomon_reports
      for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='backups_log' and policyname='auth select backups') then
    create policy "auth select backups" on public.backups_log
      for select using (auth.role() = 'authenticated');
  end if;
  -- Inserts come from the admin client (cron / server route), so no insert policy needed for app users.
end $$;

-- Storage bucket for backup JSON exports. Private — only service role reads.
insert into storage.buckets (id, name, public)
  values ('backups', 'backups', false)
  on conflict (id) do nothing;
