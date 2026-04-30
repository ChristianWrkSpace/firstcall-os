-- Customer Portal — per-job public share link via signed token in URL.
alter table public.jobs add column if not exists customer_share_token text unique;
create index if not exists idx_jobs_share_token on public.jobs(customer_share_token);
