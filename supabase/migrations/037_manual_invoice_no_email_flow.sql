-- Reuse any active manual invoice for a job, not only drafts.
-- This prevents an emailed invoice from making the job offer another duplicate invoice.
-- Existing duplicate historical rows are preserved for manual review.

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

  select i.id into v_invoice_id
  from public.invoices as i
  where i.job_id = p_job_id
    and i.is_manual_billing = true
    and i.status <> 'void'
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
