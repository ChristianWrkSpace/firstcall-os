-- Boring reliability: isolate test work, dedupe automation, and fail closed.

alter table public.jobs
  add column if not exists is_test boolean not null default false;

alter table public.legal_documents
  add column if not exists automation_key text;

-- Automated documents get a stable per-job key (for example,
-- demand-letter:<invoice-id>). Manual drafts keep this column null.
create unique index if not exists uq_legal_documents_job_automation_key
  on public.legal_documents(job_id, automation_key)
  where automation_key is not null;

-- Automated lifecycle emails reserve a stable key before sending. Existing
-- history remains untouched because legacy rows keep this column null.
alter table public.customer_notifications
  add column if not exists dedupe_key text;

create unique index if not exists uq_customer_notifications_dedupe_key
  on public.customer_notifications(dedupe_key)
  where dedupe_key is not null;

create or replace function public.enforce_test_job_safety()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.is_test then
    new.auto_actions_paused := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_test_job_safety on public.jobs;
create trigger trg_enforce_test_job_safety
before insert or update on public.jobs
for each row execute function public.enforce_test_job_safety();

-- Defense in depth: even service-role automation cannot create an automated
-- legal document for a test job. Staff may still add manual paperwork.
create or replace function public.block_test_job_automated_legal_docs()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.automation_key is not null and exists (
    select 1 from public.jobs j where j.id = new.job_id and j.is_test
  ) then
    raise exception 'Automated legal documents are disabled for test jobs';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_test_job_automated_legal_docs on public.legal_documents;
create trigger trg_block_test_job_automated_legal_docs
before insert or update on public.legal_documents
for each row execute function public.block_test_job_automated_legal_docs();

-- Legal commitments survive direct PostgREST calls, service-role mistakes, and
-- cascading job deletion. Only drafts/void records are physically removable.
create or replace function public.protect_committed_legal_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status not in ('draft', 'void') then
    raise exception 'Committed legal documents cannot be deleted; void them instead';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_committed_legal_document on public.legal_documents;
create trigger trg_protect_committed_legal_document
before delete on public.legal_documents
for each row execute function public.protect_committed_legal_document();

-- Tombstoning is allowed only while an automated document is still a draft.
-- This closes read-then-update races with approval, sending, and signing.
create or replace function public.protect_legal_document_status_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'void'
     and old.automation_key is not null
     and old.status not in ('draft', 'void') then
    raise exception 'Committed automated legal documents cannot be tombstoned';
  end if;
  if new.status = 'draft' and old.status <> 'draft' then
    raise exception 'Committed legal documents cannot return to draft';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_legal_document_status_transition on public.legal_documents;
create trigger trg_protect_legal_document_status_transition
before update of status on public.legal_documents
for each row execute function public.protect_legal_document_status_transition();

-- A job with signed/sent legal records or financial history must be retained.
-- This prevents an allowed jobs DELETE policy from cascading through evidence.
create or replace function public.protect_job_financial_history()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.legal_documents d
    where d.job_id = old.id and d.status not in ('draft', 'void')
  ) or exists (
    select 1 from public.invoices i
    where i.job_id = old.id and i.status not in ('draft', 'void')
  ) or exists (
    select 1
    from public.payments p
    join public.invoices i on i.id = p.invoice_id
    where i.job_id = old.id
  ) or exists (
    select 1 from public.estimates e
    where e.job_id = old.id and e.status not in ('draft', 'rejected')
  ) or exists (
    select 1 from public.job_documents d
    where d.job_id = old.id and (d.signed or d.signed_at is not null)
  ) then
    raise exception 'Jobs with committed legal or financial history cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_job_financial_history on public.jobs;
create trigger trg_protect_job_financial_history
before delete on public.jobs
for each row execute function public.protect_job_financial_history();

create or replace function public.protect_committed_invoice()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status not in ('draft', 'void') or exists (
    select 1 from public.payments p where p.invoice_id = old.id
  ) then
    raise exception 'Committed invoices cannot be deleted; void them instead';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_committed_invoice on public.invoices;
create trigger trg_protect_committed_invoice
before delete on public.invoices
for each row execute function public.protect_committed_invoice();

create or replace function public.protect_committed_estimate()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status not in ('draft', 'rejected') then
    raise exception 'Committed estimates cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_committed_estimate on public.estimates;
create trigger trg_protect_committed_estimate
before delete on public.estimates
for each row execute function public.protect_committed_estimate();

create or replace function public.protect_signed_job_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.signed or old.signed_at is not null then
    raise exception 'Signed uploaded documents cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_signed_job_document on public.job_documents;
create trigger trg_protect_signed_job_document
before delete on public.job_documents
for each row execute function public.protect_signed_job_document();

-- Replace broad FOR ALL policies with operation-specific access. Financial
-- deletion must go through privileged, transactional server workflows.
drop policy if exists "backoffice access invoices" on public.invoices;
drop policy if exists "auth all invoices" on public.invoices;
drop policy if exists "owner_mgr delete invoices" on public.invoices;
create policy "backoffice read invoices" on public.invoices
  for select using (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice insert invoices" on public.invoices
  for insert with check (public.current_user_role() in ('owner','manager','office'));
create policy "backoffice update invoices" on public.invoices
  for update using (public.current_user_role() in ('owner','manager','office'))
  with check (public.current_user_role() in ('owner','manager','office'));

drop policy if exists "backoffice access payments" on public.payments;
drop policy if exists "auth all payments" on public.payments;
drop policy if exists "owner_mgr delete payments" on public.payments;
drop policy if exists "owner_mgr update payments" on public.payments;
create policy "backoffice read payments" on public.payments
  for select using (public.current_user_role() in ('owner','manager','office'));

drop policy if exists "auth all job documents" on public.job_documents;
create policy "active users read job documents" on public.job_documents
  for select using (public.is_authenticated());
create policy "active users insert job documents" on public.job_documents
  for insert with check (public.is_authenticated());
create policy "active users update job documents" on public.job_documents
  for update using (public.is_authenticated()) with check (public.is_authenticated());
create policy "backoffice delete unsigned job documents" on public.job_documents
  for delete using (public.current_user_role() in ('owner','manager','office'));
