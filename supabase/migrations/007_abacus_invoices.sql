-- Abacus — Accounts Receivable
-- Generates invoices from approved estimates, tracks payments, auto-chases adjusters.

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  estimate_id     uuid references public.estimates(id) on delete set null,
  invoice_number  text unique,
  status          text not null default 'draft' check (status in ('draft','sent','partial','paid','overdue','void')),
  issue_date      date default current_date,
  due_date        date,
  sent_to         text,
  sent_at         timestamptz,
  paid_at         timestamptz,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null
);
create index if not exists idx_invoices_job on public.invoices(job_id);
create index if not exists idx_invoices_status on public.invoices(status);
alter table public.invoices enable row level security;

create table if not exists public.invoice_line_items (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  sort_order     integer not null default 0,
  category       text,
  xactimate_code text,
  description    text not null,
  quantity       numeric(10,2) not null default 1,
  unit           text not null default 'EA',
  unit_price     numeric(10,2) not null default 0,
  line_total     numeric(12,2) generated always as (quantity * unit_price) stored,
  notes          text
);
create index if not exists idx_invoice_lines_invoice on public.invoice_line_items(invoice_id);
alter table public.invoice_line_items enable row level security;

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  amount         numeric(12,2) not null,
  method         text check (method in ('check','ach','wire','credit_card','cash','other')),
  reference      text,
  received_at    date default current_date,
  notes          text,
  recorded_by    uuid references public.profiles(id) on delete set null
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
alter table public.payments enable row level security;

create table if not exists public.invoice_reminders (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  reminder_type  text not null check (reminder_type in ('gentle','firm','final')),
  sent_to        text not null,
  sent_at        timestamptz default now(),
  email_subject  text,
  email_body     text,
  sent_by        uuid references public.profiles(id) on delete set null
);
create index if not exists idx_reminders_invoice on public.invoice_reminders(invoice_id);
alter table public.invoice_reminders enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='auth all invoices') then
    create policy "auth all invoices" on public.invoices for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='invoice_line_items' and policyname='auth all invoice lines') then
    create policy "auth all invoice lines" on public.invoice_line_items for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='auth all payments') then
    create policy "auth all payments" on public.payments for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='invoice_reminders' and policyname='auth all reminders') then
    create policy "auth all reminders" on public.invoice_reminders for all using (auth.role() = 'authenticated');
  end if;
end $$;

-- Auto-generate invoice numbers like INV-YYYYMM-NNNN
create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
declare
  yyyymm text := to_char(now(), 'YYYYMM');
  next_num int;
begin
  if new.invoice_number is null or new.invoice_number = '' then
    select coalesce(max(cast(substring(invoice_number from 13) as int)), 0) + 1
      into next_num
      from public.invoices
      where invoice_number like 'INV-' || yyyymm || '-%';
    new.invoice_number := 'INV-' || yyyymm || '-' || lpad(next_num::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists set_invoice_number on public.invoices;
create trigger set_invoice_number before insert on public.invoices
  for each row execute function generate_invoice_number();
