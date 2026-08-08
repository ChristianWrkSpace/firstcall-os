-- Payment integrity: positive amounts, durable Stripe event deduplication,
-- and atomic payment/invoice reconciliation.

-- Enforce the invariant at the database boundary for every payment source.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'payments_amount_positive'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_amount_positive check (amount > 0) not valid;
  end if;
end
$$;

-- The primary key is Stripe's immutable event identifier. A row is inserted in
-- the same transaction as the payment, so failed processing never marks an
-- event complete and successful processing can never be applied twice.
create table if not exists public.stripe_payment_events (
  event_id text primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_id uuid unique references public.payments(id),
  processed_at timestamptz not null default now()
);

alter table public.stripe_payment_events enable row level security;

create index if not exists idx_stripe_payment_events_invoice
  on public.stripe_payment_events(invoice_id);

create or replace function public.process_stripe_payment(
  p_event_id text,
  p_invoice_id uuid,
  p_amount numeric,
  p_reference text,
  p_payment_kind text
)
returns table (
  processed boolean,
  already_processed boolean,
  payment_id uuid,
  invoice_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment_id uuid;
  v_existing_payment_id uuid;
  v_invoice_status text;
  v_total_paid numeric(14,2);
  v_total_due numeric(14,2);
begin
  if p_event_id is null or char_length(btrim(p_event_id)) = 0 then
    raise exception using errcode = '22023', message = 'Stripe event ID is required';
  end if;

  if p_invoice_id is null then
    raise exception using errcode = '22023', message = 'Invoice ID is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'Payment amount must be positive';
  end if;

  if p_reference is null or char_length(btrim(p_reference)) = 0 then
    raise exception using errcode = '22023', message = 'Stripe payment reference is required';
  end if;

  if p_payment_kind is null or p_payment_kind not in ('full', 'deductible') then
    raise exception using errcode = '22023', message = 'Invalid payment kind';
  end if;

  insert into public.stripe_payment_events (event_id, invoice_id)
  values (btrim(p_event_id), p_invoice_id)
  on conflict (event_id) do nothing;

  if not found then
    select spe.payment_id, i.status
      into v_existing_payment_id, v_invoice_status
      from public.stripe_payment_events as spe
      join public.invoices as i on i.id = spe.invoice_id
     where spe.event_id = btrim(p_event_id);

    return query select false, true, v_existing_payment_id, v_invoice_status;
    return;
  end if;

  select i.status
    into v_invoice_status
    from public.invoices as i
   where i.id = p_invoice_id
   for update;

  if not found then
    raise exception using errcode = '23503', message = 'Invoice not found';
  end if;

  if v_invoice_status in ('paid', 'void') then
    update public.stripe_payment_events
       set processed_at = now()
     where event_id = btrim(p_event_id);
    return query select false, false, null::uuid, v_invoice_status;
    return;
  end if;

  select coalesce(sum(p.amount), 0)
    into v_total_paid
    from public.payments as p
   where p.invoice_id = p_invoice_id;

  select coalesce(sum(li.line_total), 0)
    into v_total_due
    from public.invoice_line_items as li
   where li.invoice_id = p_invoice_id;

  if v_total_due <= 0 or p_amount > (v_total_due - v_total_paid) then
    update public.stripe_payment_events
       set processed_at = now()
     where event_id = btrim(p_event_id);
    return query select false, false, null::uuid, v_invoice_status;
    return;
  end if;

  insert into public.payments (
    invoice_id,
    amount,
    method,
    reference,
    received_at,
    notes
  ) values (
    p_invoice_id,
    p_amount,
    'credit_card',
    'stripe:' || btrim(p_reference),
    current_date,
    case p_payment_kind
      when 'deductible' then 'Deductible paid online via Stripe Checkout'
      else 'Paid online via Stripe Checkout'
    end
  )
  returning id into v_payment_id;

  select coalesce(sum(p.amount), 0)
    into v_total_paid
    from public.payments as p
   where p.invoice_id = p_invoice_id;

  select coalesce(sum(li.line_total), 0)
    into v_total_due
    from public.invoice_line_items as li
   where li.invoice_id = p_invoice_id;

  v_invoice_status := case
    when v_total_due > 0 and v_total_paid >= v_total_due then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'sent'
  end;

  update public.invoices
     set status = v_invoice_status,
         paid_at = case when v_invoice_status = 'paid' then now() else null end,
         updated_at = now()
   where id = p_invoice_id;

  update public.stripe_payment_events
     set payment_id = v_payment_id,
         processed_at = now()
   where event_id = btrim(p_event_id);

  return query select true, false, v_payment_id, v_invoice_status;
end;
$$;

-- This RPC is an internal webhook boundary. Do not expose it to browser roles.
revoke all on function public.process_stripe_payment(text, uuid, numeric, text, text)
  from public;
revoke all on function public.process_stripe_payment(text, uuid, numeric, text, text)
  from anon;
revoke all on function public.process_stripe_payment(text, uuid, numeric, text, text)
  from authenticated;
grant execute on function public.process_stripe_payment(text, uuid, numeric, text, text)
  to service_role;

-- Invoice creation and line copying must not cross-link jobs or leave a partial
-- invoice when copying estimate lines fails.
create or replace function public.create_invoice_from_estimate(
  p_estimate_id uuid,
  p_job_id uuid,
  p_due_date date,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invoice_id uuid;
  v_estimate_status text;
  v_estimate_job_id uuid;
begin
  select status, job_id into v_estimate_status, v_estimate_job_id
  from public.estimates where id = p_estimate_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'Estimate not found';
  end if;
  if v_estimate_job_id is distinct from p_job_id then
    raise exception using errcode = '22023', message = 'Estimate does not belong to job';
  end if;
  if v_estimate_status not in ('approved', 'sent') then
    raise exception using errcode = '22023', message = 'Estimate must be approved before invoicing';
  end if;

  select id into v_invoice_id
  from public.invoices
  where estimate_id = p_estimate_id and status <> 'void'
  order by created_at asc
  limit 1;
  if found then
    return v_invoice_id;
  end if;

  insert into public.invoices (job_id, estimate_id, status, due_date, created_by)
  values (p_job_id, p_estimate_id, 'draft', p_due_date, p_created_by)
  returning id into v_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, sort_order, category, xactimate_code, description,
    quantity, unit, unit_price, notes
  )
  select v_invoice_id, sort_order, category, xactimate_code, description,
         quantity, unit, unit_price, notes
  from public.estimate_line_items
  where estimate_id = p_estimate_id;

  return v_invoice_id;
end;
$$;

revoke all on function public.create_invoice_from_estimate(uuid, uuid, date, uuid) from public;
revoke all on function public.create_invoice_from_estimate(uuid, uuid, date, uuid) from anon;
revoke all on function public.create_invoice_from_estimate(uuid, uuid, date, uuid) from authenticated;
grant execute on function public.create_invoice_from_estimate(uuid, uuid, date, uuid) to service_role;

-- Enforce one active invoice per estimate even for direct database writes. The
-- estimate-row lock serializes manual, automatic, and authenticated inserts.
create or replace function public.prevent_duplicate_active_invoice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_estimate_job_id uuid;
begin
  if new.estimate_id is null or new.status = 'void' then
    return new;
  end if;

  select job_id into v_estimate_job_id
  from public.estimates
  where id = new.estimate_id for update;
  if not found or v_estimate_job_id is distinct from new.job_id then
    raise exception using errcode = '23514', message = 'Invoice job must match estimate job';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.estimate_id = new.estimate_id
      and i.status <> 'void'
      and i.id <> new.id
  ) then
    raise exception using errcode = '23505', message = 'An active invoice already exists for this estimate';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_duplicate_active_invoice on public.invoices;
create trigger prevent_duplicate_active_invoice
before insert or update of estimate_id, status on public.invoices
for each row execute function public.prevent_duplicate_active_invoice();

-- Finalized financial documents are immutable. This is enforced beneath server
-- actions so service-role mistakes cannot rewrite sent/approved pricing.
create or replace function public.require_draft_estimate_for_line_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_estimate_id uuid;
begin
  v_estimate_id := case when tg_op = 'DELETE' then old.estimate_id else new.estimate_id end;
  select status into v_status from public.estimates
  where id = v_estimate_id for update;
  if v_status is distinct from 'draft' then
    raise exception using errcode = '55000', message = 'Only draft estimates may be edited';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists require_draft_estimate_for_line_change on public.estimate_line_items;
create trigger require_draft_estimate_for_line_change
before insert or update or delete on public.estimate_line_items
for each row execute function public.require_draft_estimate_for_line_change();

create or replace function public.require_draft_invoice_for_line_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_invoice_id uuid;
begin
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  select status into v_status from public.invoices
  where id = v_invoice_id for update;
  if v_status is distinct from 'draft' then
    raise exception using errcode = '55000', message = 'Only draft invoices may be edited';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists require_draft_invoice_for_line_change on public.invoice_line_items;
create trigger require_draft_invoice_for_line_change
before insert or update or delete on public.invoice_line_items
for each row execute function public.require_draft_invoice_for_line_change();

-- Manual payment recording is a single transaction: lock the invoice, validate
-- the live balance, insert the payment, and reconcile invoice status.
create or replace function public.record_payment_and_reconcile(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_received_at date,
  p_notes text,
  p_recorded_by uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_invoice_status text;
  v_total_paid numeric(14,2);
  v_total_due numeric(14,2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'Payment amount must be positive';
  end if;

  select status into v_invoice_status
  from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'Invoice not found';
  end if;
  if v_invoice_status = 'void' then
    raise exception using errcode = '22023', message = 'Cannot pay a void invoice';
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments where invoice_id = p_invoice_id;
  select coalesce(sum(line_total), 0) into v_total_due
  from public.invoice_line_items where invoice_id = p_invoice_id;

  if v_total_due <= 0 or p_amount > (v_total_due - v_total_paid) then
    raise exception using errcode = '22023', message = 'Payment exceeds outstanding balance';
  end if;

  insert into public.payments (
    invoice_id, amount, method, reference, received_at, notes, recorded_by
  ) values (
    p_invoice_id, p_amount, nullif(btrim(p_method), ''),
    nullif(btrim(p_reference), ''), coalesce(p_received_at, current_date),
    nullif(btrim(p_notes), ''), p_recorded_by
  );

  v_total_paid := v_total_paid + p_amount;
  v_status := case
    when v_total_paid >= v_total_due then 'paid'
    else 'partial'
  end;

  update public.invoices
  set status = v_status,
      paid_at = case when v_status = 'paid' then now() else null end,
      updated_at = now()
  where id = p_invoice_id;

  return v_status;
end;
$$;

revoke all on function public.record_payment_and_reconcile(uuid, numeric, text, text, date, text, uuid) from public;
revoke all on function public.record_payment_and_reconcile(uuid, numeric, text, text, date, text, uuid) from anon;
revoke all on function public.record_payment_and_reconcile(uuid, numeric, text, text, date, text, uuid) from authenticated;
grant execute on function public.record_payment_and_reconcile(uuid, numeric, text, text, date, text, uuid) to service_role;

-- Manual payment deletion and invoice reconciliation must also be atomic.
create or replace function public.delete_payment_and_reconcile(
  p_payment_id uuid,
  p_invoice_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_total_paid numeric(14,2);
  v_total_due numeric(14,2);
begin
  perform 1 from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'Invoice not found';
  end if;

  delete from public.payments
  where id = p_payment_id and invoice_id = p_invoice_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Payment not found';
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments where invoice_id = p_invoice_id;
  select coalesce(sum(line_total), 0) into v_total_due
  from public.invoice_line_items where invoice_id = p_invoice_id;

  v_status := case
    when v_total_due > 0 and v_total_paid >= v_total_due then 'paid'
    when v_total_paid > 0 then 'partial'
    else 'sent'
  end;

  update public.invoices
  set status = v_status,
      paid_at = case when v_status = 'paid' then now() else null end,
      updated_at = now()
  where id = p_invoice_id;

  return v_status;
end;
$$;

revoke all on function public.delete_payment_and_reconcile(uuid, uuid) from public;
revoke all on function public.delete_payment_and_reconcile(uuid, uuid) from anon;
revoke all on function public.delete_payment_and_reconcile(uuid, uuid) from authenticated;
grant execute on function public.delete_payment_and_reconcile(uuid, uuid) to service_role;
