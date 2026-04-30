-- Documents Vault — per-job storage for legal, insurance, and operational docs.
create table if not exists public.job_documents (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  doc_type        text not null check (doc_type in (
    'aob','direction_to_pay','customer_authorization','coi',
    'insurance_policy','adjuster_correspondence','carrier_scope',
    'drying_certificate','final_report','permit','lien_waiver',
    'subcontractor_agreement','w9','before_after_photos','other'
  )),
  filename        text not null,
  storage_path    text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  notes           text,
  signed          boolean default false,
  signed_at       timestamptz,
  signed_by_name  text
);
create index if not exists idx_job_documents_job on public.job_documents(job_id);
create index if not exists idx_job_documents_type on public.job_documents(doc_type);
alter table public.job_documents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='job_documents' and policyname='auth all job documents') then
    create policy "auth all job documents" on public.job_documents for all using (auth.role() = 'authenticated');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='objects' and schemaname='storage' and policyname='auth users upload job-documents') then
    create policy "auth users upload job-documents"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'job-documents');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and schemaname='storage' and policyname='auth users read job-documents') then
    create policy "auth users read job-documents"
      on storage.objects for select
      to authenticated
      using (bucket_id = 'job-documents');
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and schemaname='storage' and policyname='auth users delete job-documents') then
    create policy "auth users delete job-documents"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'job-documents');
  end if;
end $$;
