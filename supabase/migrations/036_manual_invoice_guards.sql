-- Final guards for manual-only invoicing.
-- Keep invoice provenance immutable and correct invoice suffix parsing beyond 999.

create or replace function public.set_invoice_billing_origin()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.is_manual_billing := new.estimate_id is null;
    return new;
  end if;

  if old.is_manual_billing is distinct from new.is_manual_billing
     or old.estimate_id is distinct from new.estimate_id then
    raise exception using
      errcode = '55000',
      message = 'Invoice billing origin is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_billing_origin on public.invoices;
create trigger set_invoice_billing_origin
before insert on public.invoices
for each row execute function public.set_invoice_billing_origin();

drop trigger if exists prevent_manual_billing_origin_change on public.invoices;
create trigger prevent_manual_billing_origin_change
before update of is_manual_billing, estimate_id on public.invoices
for each row execute function public.set_invoice_billing_origin();

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
    select coalesce(max(cast(substring(invoice_number from 12) as integer)), 0) + 1
      into next_num
      from public.invoices
      where invoice_number like 'INV-' || yyyymm || '-%';
    new.invoice_number := 'INV-' || yyyymm || '-' || lpad(next_num::text, 4, '0');
  end if;
  return new;
end;
$$;

-- There is no estimate-to-invoice path in manual-only mode.
drop function if exists public.create_invoice_from_estimate(uuid, uuid, date, uuid);
