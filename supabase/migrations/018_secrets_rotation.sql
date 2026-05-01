-- Track when each app secret was last rotated. Append-only log; latest row
-- per secret_name represents the current rotation state.

create table if not exists public.secrets_rotation_log (
  id            uuid primary key default gen_random_uuid(),
  rotated_at    timestamptz default now(),
  secret_name   text not null,
  rotated_by    uuid references public.profiles(id) on delete set null,
  notes         text
);
create index if not exists idx_secrets_rotation_name on public.secrets_rotation_log(secret_name, rotated_at desc);
alter table public.secrets_rotation_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='secrets_rotation_log' and policyname='owner select secrets rotation') then
    create policy "owner select secrets rotation" on public.secrets_rotation_log
      for select using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('owner','manager') and p.active = true
        )
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='secrets_rotation_log' and policyname='owner insert secrets rotation') then
    create policy "owner insert secrets rotation" on public.secrets_rotation_log
      for insert with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('owner','manager') and p.active = true
        )
      );
  end if;
end $$;
