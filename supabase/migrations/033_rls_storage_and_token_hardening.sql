-- ============================================================
-- 033 RLS, storage, and public bearer-link hardening
-- ============================================================

-- Defense in depth: even an owner using an authenticated browser session may
-- not change their own role or reactivate/deactivate themselves. Service-role
-- administration has auth.uid() = null and remains available for recovery.
create or replace function public.prevent_self_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.id
     and (old.role is distinct from new.role or old.active is distinct from new.active) then
    raise exception 'You cannot change your own role or active state.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_privilege_change on public.profiles;
create trigger prevent_self_privilege_change
before update of role, active on public.profiles
for each row execute function public.prevent_self_privilege_change();

-- Public links are bearer credentials. Existing raw portal tokens are migrated
-- to SHA-256 digests, then erased; newly issued links store only their digest.
create extension if not exists pgcrypto;

alter table public.legal_documents
  add column if not exists signing_token_expires_at timestamptz;
alter table public.jobs
  add column if not exists customer_share_expires_at timestamptz;
alter table public.jobs
  add column if not exists adjuster_share_expires_at timestamptz;
alter table public.jobs
  add column if not exists customer_share_token_hash text;
alter table public.jobs
  add column if not exists adjuster_share_token_hash text;

update public.legal_documents
set signing_token_expires_at = now() + interval '7 days'
where signing_token is not null and signing_token_expires_at is null;
update public.legal_documents
set signing_token = encode(extensions.digest(signing_token, 'sha256'), 'hex')
where signing_token is not null
  and signing_token !~ '^[0-9a-f]{64}$';
update public.jobs
set customer_share_token_hash = encode(extensions.digest(customer_share_token, 'sha256'), 'hex'),
    customer_share_expires_at = coalesce(customer_share_expires_at, now() + interval '7 days'),
    customer_share_token = null
where customer_share_token is not null;
update public.jobs
set adjuster_share_token_hash = encode(extensions.digest(adjuster_share_token, 'sha256'), 'hex'),
    adjuster_share_expires_at = coalesce(adjuster_share_expires_at, now() + interval '7 days'),
    adjuster_share_token = null
where adjuster_share_token is not null;

create index if not exists idx_legal_docs_active_signing_token
  on public.legal_documents(signing_token)
  where signing_token is not null;
create unique index if not exists idx_jobs_active_customer_share_hash
  on public.jobs(customer_share_token_hash)
  where customer_share_token_hash is not null;
create unique index if not exists idx_jobs_active_adjuster_share_hash
  on public.jobs(adjuster_share_token_hash)
  where adjuster_share_token_hash is not null;

-- Remove broad policies that gave every authenticated JWT full financial CRUD.
drop policy if exists "auth all estimates" on public.estimates;
drop policy if exists "auth all line items" on public.estimate_line_items;
drop policy if exists "auth all invoices" on public.invoices;
drop policy if exists "auth read invoices" on public.invoices;
drop policy if exists "auth write invoices" on public.invoices;
drop policy if exists "auth update invoices" on public.invoices;
drop policy if exists "owner_mgr delete invoices" on public.invoices;
drop policy if exists "auth all invoice lines" on public.invoice_line_items;
drop policy if exists "auth all payments" on public.payments;
drop policy if exists "auth read payments" on public.payments;
drop policy if exists "auth write payments" on public.payments;
drop policy if exists "owner_mgr update payments" on public.payments;
drop policy if exists "owner_mgr delete payments" on public.payments;
drop policy if exists "auth all reminders" on public.invoice_reminders;
drop policy if exists "auth all tech labor" on public.tech_labor_entries;
drop policy if exists "auth all consumables" on public.consumables_used;
drop policy if exists "auth all vehicle exp" on public.vehicle_expenses;
drop policy if exists "auth all cost basis" on public.cost_basis_settings;
drop policy if exists "auth all subs" on public.subcontractors;
drop policy if exists "auth all sub invoices" on public.sub_invoices;
drop policy if exists "auth select legal docs" on public.legal_documents;
drop policy if exists "auth insert legal docs" on public.legal_documents;
drop policy if exists "auth update legal docs" on public.legal_documents;
drop policy if exists "owner manager delete legal docs" on public.legal_documents;

-- Estimates are operationally visible to active field users, but only office
-- roles may mutate prices or approval state.
drop policy if exists "active users read estimates" on public.estimates;
drop policy if exists "backoffice write estimates" on public.estimates;
drop policy if exists "active users read estimate lines" on public.estimate_line_items;
drop policy if exists "backoffice write estimate lines" on public.estimate_line_items;
drop policy if exists "backoffice access invoices" on public.invoices;
drop policy if exists "backoffice access invoice lines" on public.invoice_line_items;
drop policy if exists "backoffice access payments" on public.payments;
drop policy if exists "backoffice access reminders" on public.invoice_reminders;
drop policy if exists "backoffice access tech labor" on public.tech_labor_entries;
drop policy if exists "backoffice access consumables" on public.consumables_used;
drop policy if exists "backoffice access vehicle expenses" on public.vehicle_expenses;
drop policy if exists "management access cost basis" on public.cost_basis_settings;
drop policy if exists "backoffice access subcontractors" on public.subcontractors;
drop policy if exists "backoffice access subcontractor invoices" on public.sub_invoices;
drop policy if exists "backoffice read legal docs" on public.legal_documents;
drop policy if exists "backoffice insert legal docs" on public.legal_documents;
drop policy if exists "backoffice update legal docs" on public.legal_documents;
drop policy if exists "management delete legal docs" on public.legal_documents;

create policy "active users read estimates" on public.estimates
  for select using (public.is_authenticated());
create policy "backoffice write estimates" on public.estimates
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "active users read estimate lines" on public.estimate_line_items
  for select using (public.is_authenticated());
create policy "backoffice write estimate lines" on public.estimate_line_items
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));

create policy "backoffice read legal docs" on public.legal_documents
  for select using (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice insert legal docs" on public.legal_documents
  for insert with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice update legal docs" on public.legal_documents
  for update using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "management delete legal docs" on public.legal_documents
  for delete using (public.current_user_role() in ('owner','manager'));

-- Customer balances, payments, reminders, costs, and subcontractor data are
-- back-office data and are not directly readable or writable by technicians.
create policy "backoffice access invoices" on public.invoices
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access invoice lines" on public.invoice_line_items
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access payments" on public.payments
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access reminders" on public.invoice_reminders
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access tech labor" on public.tech_labor_entries
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access consumables" on public.consumables_used
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access vehicle expenses" on public.vehicle_expenses
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "management access cost basis" on public.cost_basis_settings
  for all using (public.current_user_role() in ('owner','manager'))
  with check (public.current_user_role() in ('owner','manager'));
create policy "backoffice access subcontractors" on public.subcontractors
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice access subcontractor invoices" on public.sub_invoices
  for all using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));

-- Storage object names encode the owning job. Photos/documents use
-- <job-id>/..., while videos use videos/<job-id>/....
create or replace function public.storage_job_id(object_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) = 'videos'
      then nullif(split_part(object_name, '/', 2), '')
    else nullif(split_part(object_name, '/', 1), '')
  end
$$;

create or replace function public.can_access_job_storage(job_id_text text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_authenticated()
    and (
      public.current_user_role() in ('owner','manager','office')
      or exists (
        select 1 from public.jobs j
        where j.id::text = job_id_text
          and (
            j.lead_tech_id = auth.uid()
            or exists (
              select 1 from public.job_assignments ja
              where ja.job_id = j.id and ja.profile_id = auth.uid()
            )
          )
      )
    )
$$;

revoke all on function public.storage_job_id(text) from public;
revoke all on function public.can_access_job_storage(text) from public;
grant execute on function public.storage_job_id(text) to authenticated;
grant execute on function public.can_access_job_storage(text) to authenticated;

drop policy if exists "auth users upload job-photos" on storage.objects;
drop policy if exists "auth users read job-photos" on storage.objects;
drop policy if exists "auth users delete job-photos" on storage.objects;
drop policy if exists "auth users upload job-documents" on storage.objects;
drop policy if exists "auth users read job-documents" on storage.objects;
drop policy if exists "auth users delete job-documents" on storage.objects;
drop policy if exists "assigned users upload job media" on storage.objects;
drop policy if exists "assigned users read job media" on storage.objects;
drop policy if exists "backoffice delete job media" on storage.objects;
drop policy if exists "assigned users upload job documents" on storage.objects;
drop policy if exists "assigned users read job documents" on storage.objects;
drop policy if exists "backoffice delete job documents" on storage.objects;

create policy "assigned users upload job media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.can_access_job_storage(public.storage_job_id(name))
  );
create policy "assigned users read job media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-photos'
    and public.can_access_job_storage(public.storage_job_id(name))
  );
create policy "backoffice delete job media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and public.current_user_role() in ('owner','manager','office')
    and public.can_access_job_storage(public.storage_job_id(name))
  );

create policy "assigned users upload job documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-documents'
    and public.can_access_job_storage(public.storage_job_id(name))
  );
create policy "assigned users read job documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-documents'
    and public.can_access_job_storage(public.storage_job_id(name))
  );
create policy "backoffice delete job documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-documents'
    and public.current_user_role() in ('owner','manager','office')
    and public.can_access_job_storage(public.storage_job_id(name))
  );
