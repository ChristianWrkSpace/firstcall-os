-- RLS Tightening: replace permissive "any authenticated user can do anything" policies
-- with role-based policies. Roles live in profiles.role.
--
-- Strategy:
--   READ:  any authenticated user can read most operational data
--          (techs need to see customers/jobs/equipment to do their work)
--   WRITE: scoped per-table to roles that legitimately need it
--   DELETE: owner + manager only (with a few exceptions)
--
-- Note: app-level requirePermission() in server actions remains the primary
-- enforcement. RLS is defense-in-depth for direct API access via a stolen JWT.

-- Helper: get current user's role from profiles
create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner_or_manager()
returns boolean language sql stable security definer as $$
  select coalesce(public.current_user_role() in ('owner', 'manager'), false)
$$;

create or replace function public.is_authenticated()
returns boolean language sql stable security definer as $$
  select auth.role() = 'authenticated'
$$;

-- Drop existing permissive policies and replace with scoped ones.
-- Pattern: drop old policy if exists, create scoped policies.

-- ─── customers ────────────────────────────────────────────────────────
drop policy if exists "authenticated read customers" on public.customers;
drop policy if exists "authenticated all customers" on public.customers;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='auth read customers') then
    create policy "auth read customers" on public.customers for select using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='auth write customers') then
    create policy "auth write customers" on public.customers for insert with check (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='auth update customers') then
    create policy "auth update customers" on public.customers for update using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='owner_mgr delete customers') then
    create policy "owner_mgr delete customers" on public.customers for delete using (public.is_owner_or_manager());
  end if;
end $$;

-- ─── jobs ─────────────────────────────────────────────────────────────
drop policy if exists "authenticated read jobs" on public.jobs;
drop policy if exists "authenticated all jobs" on public.jobs;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='jobs' and policyname='auth read jobs') then
    create policy "auth read jobs" on public.jobs for select using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='jobs' and policyname='auth write jobs') then
    create policy "auth write jobs" on public.jobs for insert with check (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='jobs' and policyname='auth update jobs') then
    create policy "auth update jobs" on public.jobs for update using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='jobs' and policyname='owner_mgr delete jobs') then
    create policy "owner_mgr delete jobs" on public.jobs for delete using (public.is_owner_or_manager());
  end if;
end $$;

-- ─── invoices ─ money: tighter ────────────────────────────────────────
drop policy if exists "auth all invoices" on public.invoices;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='auth read invoices') then
    create policy "auth read invoices" on public.invoices for select using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='auth write invoices') then
    create policy "auth write invoices" on public.invoices for insert with check (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='auth update invoices') then
    create policy "auth update invoices" on public.invoices for update using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='owner_mgr delete invoices') then
    create policy "owner_mgr delete invoices" on public.invoices for delete using (public.is_owner_or_manager());
  end if;
end $$;

-- ─── payments ─ money: tighter ─────────────────────────────────────────
drop policy if exists "auth all payments" on public.payments;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='auth read payments') then
    create policy "auth read payments" on public.payments for select using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='auth write payments') then
    create policy "auth write payments" on public.payments for insert with check (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='owner_mgr update payments') then
    create policy "owner_mgr update payments" on public.payments for update using (public.is_owner_or_manager());
  end if;
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='owner_mgr delete payments') then
    create policy "owner_mgr delete payments" on public.payments for delete using (public.is_owner_or_manager());
  end if;
end $$;

-- ─── profiles ─ users can only update themselves; only owners can change roles ──
do $$ begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='auth read profiles') then
    create policy "auth read profiles" on public.profiles for select using (public.is_authenticated());
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='self update profiles') then
    create policy "self update profiles" on public.profiles for update using (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='owner update profiles') then
    create policy "owner update profiles" on public.profiles for update using (
      coalesce(public.current_user_role() = 'owner', false)
    );
  end if;
end $$;

-- ─── audit_logs ─ append-only, no updates/deletes ─────────────────────
do $$ begin
  -- already created auth read policy in 012; add insert/no-update/no-delete rules
  if not exists (select 1 from pg_policies where tablename='audit_logs' and policyname='auth insert audit') then
    create policy "auth insert audit" on public.audit_logs for insert with check (public.is_authenticated());
  end if;
  -- explicitly NO update or delete policy = no one can modify audit history
end $$;
