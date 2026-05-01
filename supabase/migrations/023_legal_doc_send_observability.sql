-- Track every send attempt on a legal doc so the office can see WHY a doc
-- didn't reach the customer (no email on file? auto-paused? Resend down?).
-- Replaces silent failures with visible diagnostics.

alter table public.legal_documents
  add column if not exists last_send_attempt jsonb;
