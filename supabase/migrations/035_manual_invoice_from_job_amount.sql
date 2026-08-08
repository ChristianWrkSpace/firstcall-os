-- Create one editable draft invoice directly from the amount saved on a job.
-- Existing estimate-backed invoices and historical estimate records are untouched.

alter table public.invoices
  add column if not exists is_manual_billing boolean not null default false;

create unique index if not exists idx_one_manual_draft_per_job
  on public.invoices(job_id)
  where is_manual_billing = true and status = 'draft';

-- The legacy number trigger used MAX + 1 without a shared lock. Serialize
-- number allocation across jobs so simultaneous invoice creation cannot collide.
create or replace function public.generate_invoice_number()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  yyyymm text := to_char(now(), 'YYYYMM');
  next_num integer;
begin
  perform pg_advisory_xact_lock(hashtext('public.invoices.invoice_number'));
  if new.invoice_number is null or new.invoice_number = '' then
    select coalesce(max(cast(substring(invoice_number from 13) as integer)), 0) + 1
      into next_num
      from public.invoices
      where invoice_number like 'INV-' || yyyymm || '-%';
    new.invoice_number := 'INV-' || yyyymm || '-' || lpad(next_num::text, 4, '0');
  end if;
  return new;
end;
$$;

create or replace function public.create_manual_invoice_from_job_amount(
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
  v_amount numeric(10,2);
  v_job_type text;
  v_description text;
begin
  select estimated_value, type
    into v_amount, v_job_type
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'Job not found';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception using errcode = '22023', message = 'Enter a billing amount greater than zero first';
  end if;

  -- Reuse an existing manual draft so a double-click or retry cannot create
  -- duplicate invoices. Once it is sent or voided, another draft may be made.
  select i.id into v_invoice_id
  from public.invoices as i
  where i.job_id = p_job_id
    and i.is_manual_billing = true
    and i.status = 'draft'
  order by i.created_at desc
  limit 1;

  if found then
    return v_invoice_id;
  end if;

  v_description := case v_job_type
    when 'water' then 'Water mitigation services'
    when 'mold' then 'Mold remediation services'
    when 'fire' then 'Fire restoration services'
    when 'storm' then 'Storm restoration services'
    else 'Restoration services'
  end;

  insert into public.invoices (
    job_id, estimate_id, status, due_date, notes, created_by, is_manual_billing
  ) values (
    p_job_id, null, 'draft', p_due_date,
    'Created from manual job billing amount.', p_created_by, true
  )
  returning id into v_invoice_id;

  insert into public.invoice_line_items (
    invoice_id, sort_order, category, description, quantity, unit, unit_price
  ) values (
    v_invoice_id, 0, 'Services', v_description, 1, 'JOB', v_amount
  );

  return v_invoice_id;
end;
$$;

revoke all on function public.create_manual_invoice_from_job_amount(uuid, date, uuid) from public;
revoke all on function public.create_manual_invoice_from_job_amount(uuid, date, uuid) from anon;
revoke all on function public.create_manual_invoice_from_job_amount(uuid, date, uuid) from authenticated;
grant execute on function public.create_manual_invoice_from_job_amount(uuid, date, uuid) to service_role;
