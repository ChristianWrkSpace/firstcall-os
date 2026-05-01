-- E-signature support for legal_documents.
-- signing_token: opaque random string, becomes the auth for /sign/[token].
-- signature_data: jsonb capturing typed_name + agreement + timestamp.
-- signature_ip + signature_user_agent: audit trail required for ESIGN/UETA.

alter table public.legal_documents
  add column if not exists signing_token text unique;

alter table public.legal_documents
  add column if not exists signature_data jsonb;

alter table public.legal_documents
  add column if not exists signature_ip text;

alter table public.legal_documents
  add column if not exists signature_user_agent text;

create index if not exists idx_legal_docs_signing_token on public.legal_documents(signing_token);
