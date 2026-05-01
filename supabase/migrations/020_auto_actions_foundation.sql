-- Auto-trigger foundation: pending_approvals inbox + per-job auto-pause flag.
-- Pattern: agents auto-DRAFT (estimate, AOB, drying cert, etc.). Each draft
-- becomes a row in pending_approvals so the office sees a single feed of
-- "things to review." Approving = the user reviews/acts on the underlying
-- draft via its existing edit/approve flow. Dismissing = mark rejected and
-- (optionally) delete the underlying draft.

create table if not exists public.pending_approvals (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  kind            text not null check (kind in (
    'estimate_draft',
    'legal_doc_draft',
    'invoice_draft',
    'drying_cert_draft',
    'demand_letter_draft',
    'status_suggestion',
    'referral_attribution'
  )),
  job_id          uuid references public.jobs(id) on delete cascade,
  entity_type     text,
  entity_id       uuid,
  title           text not null,
  detail          text,
  link            text,                                          -- where to review (e.g. /jobs/[id]/legal/[docId])
  source          text not null default 'system' check (source in ('system','user')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  metadata        jsonb
);

create index if not exists idx_pending_approvals_status on public.pending_approvals(status);
create index if not exists idx_pending_approvals_job on public.pending_approvals(job_id);
create index if not exists idx_pending_approvals_entity on public.pending_approvals(entity_type, entity_id);
create index if not exists idx_pending_approvals_created on public.pending_approvals(created_at desc);

alter table public.pending_approvals enable row level security;

-- Per-job pause for auto-actions (litigated claim, hostile customer, etc.)
alter table public.jobs
  add column if not exists auto_actions_paused boolean not null default false;

create index if not exists idx_jobs_auto_paused on public.jobs(auto_actions_paused) where auto_actions_paused = true;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='pending_approvals' and policyname='auth select pending') then
    create policy "auth select pending" on public.pending_approvals
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='pending_approvals' and policyname='auth insert pending') then
    create policy "auth insert pending" on public.pending_approvals
      for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='pending_approvals' and policyname='auth update pending') then
    create policy "auth update pending" on public.pending_approvals
      for update using (auth.role() = 'authenticated');
  end if;
end $$;
