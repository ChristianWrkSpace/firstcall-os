-- Payment routing: customer-pay vs insurance vs insurance-with-deductible
-- Lets the customer portal branch to the right UX and the Stripe checkout
-- charge only the deductible when insurance is covering the rest.

alter table public.jobs
  add column if not exists payment_route text
    check (payment_route in ('customer_pay','insurance_primary','insurance_with_deductible'))
    default 'customer_pay';

alter table public.jobs
  add column if not exists deductible_amount numeric(10,2);

-- Backfill any rows missing the route (older jobs created before this column existed)
update public.jobs
  set payment_route = 'customer_pay'
  where payment_route is null;

create index if not exists idx_jobs_payment_route on public.jobs(payment_route);
