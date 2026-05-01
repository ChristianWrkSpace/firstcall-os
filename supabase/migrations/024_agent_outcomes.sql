-- Agent outcomes — recursive feedback loop.
-- Every time a human edits, approves, rejects, or revises an agent draft,
-- log the delta. Agents read their own outcome history as in-context examples
-- next time they draft the same kind of artifact, so they get better with use.

create table if not exists public.agent_outcomes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  agent           text not null check (agent in (
    'argus','ledger','esquire','solomon','hunter','extract','abacus'
  )),
  task            text not null,           -- e.g. 'scope_assessment','estimate_draft','aob_draft'
  job_id          uuid references public.jobs(id) on delete set null,
  entity_type     text,                    -- 'estimate','legal_document','scope', etc.
  entity_id       uuid,                    -- the artifact's id, when applicable
  model           text,                    -- model used for the original draft
  outcome         text not null check (outcome in (
    'approved_unchanged',
    'approved_with_edits',
    'rejected',
    'revised',
    'corrected'
  )),
  delta           jsonb,                   -- before/after diff or correction notes
  user_id         uuid references public.profiles(id) on delete set null
);

create index if not exists idx_agent_outcomes_agent_task
  on public.agent_outcomes(agent, task, created_at desc);
create index if not exists idx_agent_outcomes_job
  on public.agent_outcomes(job_id);

alter table public.agent_outcomes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='agent_outcomes' and policyname='auth read agent outcomes'
  ) then
    create policy "auth read agent outcomes"
      on public.agent_outcomes for select
      using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename='agent_outcomes' and policyname='auth insert agent outcomes'
  ) then
    create policy "auth insert agent outcomes"
      on public.agent_outcomes for insert
      with check (auth.role() = 'authenticated');
  end if;
end $$;
