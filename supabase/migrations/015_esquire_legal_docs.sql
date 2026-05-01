-- Esquire — Legal & Compliance Agent
-- Stores AI-drafted legal documents with HITL approval gate.
-- Append-style audit: who generated, who approved, when sent, to whom.

create table if not exists public.legal_documents (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  doc_type        text not null check (doc_type in (
    'aob',
    'direction_to_pay',
    'work_authorization',
    'demand_letter',
    'notice_of_appraisal',
    'drying_certificate'
  )),
  subject         text,
  body            text not null,
  status          text not null default 'draft' check (status in (
    'draft',
    'approved',
    'sent',
    'signed',
    'void'
  )),
  generated_by    uuid references public.profiles(id) on delete set null,
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  sent_at         timestamptz,
  sent_to         text,
  signed_at       timestamptz,
  signed_by_name  text,
  generation_meta jsonb
);

create index if not exists idx_legal_docs_job on public.legal_documents(job_id);
create index if not exists idx_legal_docs_type on public.legal_documents(doc_type);
create index if not exists idx_legal_docs_status on public.legal_documents(status);

alter table public.legal_documents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='legal_documents' and policyname='auth select legal docs') then
    create policy "auth select legal docs" on public.legal_documents
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='legal_documents' and policyname='auth insert legal docs') then
    create policy "auth insert legal docs" on public.legal_documents
      for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='legal_documents' and policyname='auth update legal docs') then
    create policy "auth update legal docs" on public.legal_documents
      for update using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='legal_documents' and policyname='owner manager delete legal docs') then
    -- Defense-in-depth: only owner/manager can delete legal documents
    create policy "owner manager delete legal docs" on public.legal_documents
      for delete using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('owner','manager')
            and p.active = true
        )
      );
  end if;
end $$;
