-- Audit Logs — tracks who did what (sensitive actions only)
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  user_id      uuid references public.profiles(id) on delete set null,
  user_name    text,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  details      jsonb default '{}',
  ip_address   text
);
create index if not exists idx_audit_user on public.audit_logs(user_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);
alter table public.audit_logs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='audit_logs' and policyname='auth read audit') then
    create policy "auth read audit" on public.audit_logs for select using (auth.role() = 'authenticated');
  end if;
end $$;
