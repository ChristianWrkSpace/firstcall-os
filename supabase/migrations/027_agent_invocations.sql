-- Auto-log every Claude API call so we can show "$ spent on AI this month"
-- per model, per agent (when known), per day. Drives the Compute panel
-- on Command Center + future cost dashboards.

create table if not exists public.agent_invocations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  model           text not null,                  -- "claude-opus-4-7" / "anthropic/..." (gateway prefix kept)
  agent           text,                           -- "argus" / "esquire" / null when unattributed
  task            text,                           -- e.g. "scope_assessment", "estimate_draft"
  tokens_in       int4 not null default 0,
  tokens_out      int4 not null default 0,
  cost_usd        numeric(12,6) not null default 0,
  duration_ms     int4,                           -- wall-clock time, null if not captured
  job_id          uuid references public.jobs(id) on delete set null,
  user_id         uuid references public.profiles(id) on delete set null,
  error           text                            -- populated only on failure
);
create index if not exists idx_agent_inv_created on public.agent_invocations(created_at desc);
create index if not exists idx_agent_inv_model_created on public.agent_invocations(model, created_at desc);
create index if not exists idx_agent_inv_agent on public.agent_invocations(agent, created_at desc);
alter table public.agent_invocations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='agent_invocations' and policyname='auth read agent invocations'
  ) then
    create policy "auth read agent invocations"
      on public.agent_invocations for select
      using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where tablename='agent_invocations' and policyname='auth insert agent invocations'
  ) then
    create policy "auth insert agent invocations"
      on public.agent_invocations for insert
      with check (auth.role() = 'authenticated');
  end if;
end $$;
