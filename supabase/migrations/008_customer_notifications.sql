-- Customer Notifications — branded touchpoints sent to customer email
create table if not exists public.customer_notifications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  event_type      text not null check (event_type in ('dispatched','mitigation_started','drying_started','equipment_check','work_completed','follow_up','custom')),
  channel         text not null default 'email' check (channel in ('email','sms')),
  sent_to         text not null,
  subject         text,
  body            text,
  sent_at         timestamptz default now(),
  sent_by         uuid references public.profiles(id) on delete set null,
  custom_message  text
);
create index if not exists idx_cust_notif_job on public.customer_notifications(job_id);
alter table public.customer_notifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='customer_notifications' and policyname='auth all customer notifications') then
    create policy "auth all customer notifications" on public.customer_notifications for all using (auth.role() = 'authenticated');
  end if;
end $$;
