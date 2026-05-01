-- Per-customer opt-out for auto-notify emails on job status changes.
-- Default true: most customers want progress updates. Office can flip off
-- per-customer for sensitive cases (elderly, phone-only, hostile claims).

alter table public.customers
  add column if not exists auto_notify_emails boolean not null default true;

create index if not exists idx_customers_auto_notify on public.customers(auto_notify_emails)
  where auto_notify_emails = false;
