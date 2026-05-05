-- Unit price book — anchors Ledger to real, reviewed prices instead of letting
-- the LLM invent unit_price from training-data intuition every run.
--
-- Two parts:
--   1. unit_price_book: code → unit_price ground truth. Seeded manually (CSV
--      import via scripts/seed-price-book.ts) and later auto-learned from
--      approved estimates.
--   2. estimate_line_items.pricing_source: per-line tag set at draft time
--      ('book' = Ledger pulled from book; 'guessed' = code unknown, LLM
--      invented). Powers the per-estimate confidence panel.

create table if not exists public.unit_price_book (
  xactimate_code text primary key,
  description    text not null,
  unit           text not null,
  unit_price     numeric(10,2) not null check (unit_price >= 0),
  source         text not null default 'manual' check (source in ('manual','seeded','learned')),
  sample_size    integer not null default 0,            -- for source='learned': how many approved estimates contributed
  notes          text,
  created_at     timestamptz default now(),
  last_updated   timestamptz default now()
);
create index if not exists idx_unit_price_book_source on public.unit_price_book(source);
alter table public.unit_price_book enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='unit_price_book' and policyname='auth read price book'
  ) then
    create policy "auth read price book"
      on public.unit_price_book for select
      using (auth.role() = 'authenticated');
  end if;
  -- Writes go through service-role (server actions / seed script). Authenticated
  -- users do not insert/update directly — keeps the book trustworthy.
end $$;

-- Tag every line at draft time so the operator can see at-a-glance which
-- prices came from the book vs which the LLM invented.
alter table public.estimate_line_items
  add column if not exists pricing_source text
    check (pricing_source in ('book','guessed') or pricing_source is null);
