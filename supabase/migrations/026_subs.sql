-- Subcontractors — outside companies (recon, plumbers, electricians, asbestos
-- abatement, etc.) that we pay to do part of a job. Tracks 1099-eligible
-- payments per year so tax season isn't a scramble.

create table if not exists public.subcontractors (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  name            text not null,
  trade           text,                       -- 'reconstruction', 'plumber', 'electrician', etc.
  contact_name    text,
  phone           text,
  email           text,
  ein_or_ssn_last4 text,                      -- for 1099 reference; full TIN goes in W-9 doc
  w9_file_path    text,                       -- supabase storage path to W-9 PDF
  is_corporation  boolean default false,      -- C-corp / S-corp = no 1099 threshold
  notes           text,
  active          boolean default true
);
create index if not exists idx_subs_active on public.subcontractors(active);
create index if not exists idx_subs_name on public.subcontractors(name);
alter table public.subcontractors enable row level security;

-- Per-job sub assignments + payments
create table if not exists public.sub_invoices (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors(id) on delete restrict,
  invoice_number  text,                       -- their invoice number, optional
  invoice_date    date not null default current_date,
  amount          numeric(10,2) not null check (amount >= 0),
  paid_at         timestamptz,
  payment_method  text check (payment_method in ('check','ach','zelle','cash','card','other')),
  description     text,
  receipt_path    text,                       -- supabase storage path to scanned invoice
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null
);
create index if not exists idx_sub_inv_job on public.sub_invoices(job_id);
create index if not exists idx_sub_inv_sub on public.sub_invoices(subcontractor_id);
create index if not exists idx_sub_inv_date on public.sub_invoices(invoice_date desc);
alter table public.sub_invoices enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='subcontractors' and policyname='auth all subs'
  ) then
    create policy "auth all subs"
      on public.subcontractors for all
      using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where tablename='sub_invoices' and policyname='auth all sub invoices'
  ) then
    create policy "auth all sub invoices"
      on public.sub_invoices for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
