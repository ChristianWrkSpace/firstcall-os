-- Add 'work_authorization' to the legal_documents.doc_type check constraint.
-- Idempotent: drops the existing constraint if present, recreates with the new value.

do $$
declare
  cname text;
begin
  -- Find the existing check constraint name on doc_type
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'legal_documents'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%doc_type%';

  if cname is not null then
    execute format('alter table public.legal_documents drop constraint %I', cname);
  end if;
end $$;

alter table public.legal_documents
  add constraint legal_documents_doc_type_check
  check (doc_type in (
    'aob',
    'direction_to_pay',
    'work_authorization',
    'demand_letter',
    'notice_of_appraisal',
    'drying_certificate'
  ));
