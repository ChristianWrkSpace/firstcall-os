-- Echo — personal Command Center assistant. One conversation row per
-- question/answer exchange. Feedback (👍 / 👎) flows into agent_outcomes
-- via the existing recursive-feedback pipeline so Echo learns from
-- corrections without fine-tuning.

create table if not exists public.echo_conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  user_id         uuid references public.profiles(id) on delete set null,
  question        text not null,
  answer          text not null,
  model           text not null,                  -- which tier the request landed on
  tokens_in       int4 not null default 0,
  tokens_out      int4 not null default 0,
  cost_usd        numeric(10,6) not null default 0,
  duration_ms     int4,
  feedback        text check (feedback in ('up','down')),
  feedback_note   text,
  feedback_at     timestamptz
);
create index if not exists idx_echo_conv_created on public.echo_conversations(created_at desc);
create index if not exists idx_echo_conv_user on public.echo_conversations(user_id, created_at desc);
alter table public.echo_conversations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='echo_conversations' and policyname='auth read echo'
  ) then
    create policy "auth read echo"
      on public.echo_conversations for select
      using (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where tablename='echo_conversations' and policyname='auth insert echo'
  ) then
    create policy "auth insert echo"
      on public.echo_conversations for insert
      with check (auth.role() = 'authenticated');
  end if;
  if not exists (
    select 1 from pg_policies where tablename='echo_conversations' and policyname='auth update echo feedback'
  ) then
    create policy "auth update echo feedback"
      on public.echo_conversations for update
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Extend agent_outcomes.agent check constraint to allow 'echo' so the
-- recursive-feedback preamble (lib/agent-feedback.ts) can include Echo's
-- thumbs-down corrections in future answers, same path every other agent
-- uses. Drop+re-add is the only PG-safe way to amend a CHECK.
do $$ begin
  alter table public.agent_outcomes drop constraint if exists agent_outcomes_agent_check;
  alter table public.agent_outcomes
    add constraint agent_outcomes_agent_check
    check (agent in ('argus','ledger','esquire','solomon','hunter','extract','abacus','echo'));
end $$;
