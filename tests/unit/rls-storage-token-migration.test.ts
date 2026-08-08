import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const sql = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/033_rls_storage_and_token_hardening.sql"),
  "utf8"
).replace(/\s+/g, " ").toLowerCase();

describe("033 RLS, storage, and token hardening", () => {
  it("removes broad authenticated financial write policies", () => {
    for (const policy of [
      "auth all estimates",
      "auth all line items",
      "auth all invoices",
      "auth all invoice lines",
      "auth all payments",
      "auth read invoices",
      "auth write invoices",
      "auth update invoices",
      "owner_mgr delete invoices",
      "auth read payments",
      "auth write payments",
      "owner_mgr update payments",
      "owner_mgr delete payments",
      "auth all reminders",
      "auth all tech labor",
      "auth all consumables",
      "auth all vehicle exp",
      "auth all cost basis",
      "auth all subs",
      "auth all sub invoices",
    ]) {
      expect(sql).toContain(`drop policy if exists "${policy}"`);
    }
    expect(sql).toContain("public.current_user_role() in ('owner','manager','office')");
  });

  it("scopes private storage access to active users and job paths", () => {
    expect(sql).toContain('drop policy if exists "auth users read job-photos"');
    expect(sql).toContain("create or replace function public.can_access_job_storage");
    expect(sql).toContain("public.is_authenticated()");
    expect(sql).toContain("public.storage_job_id(name)");
  });

  it("expires bearer links and stores portal credentials as hashes", () => {
    expect(sql).toContain("add column if not exists signing_token_expires_at");
    expect(sql).toContain("set signing_token = encode(extensions.digest(signing_token, 'sha256'), 'hex')");
    expect(sql).toContain("add column if not exists customer_share_expires_at");
    expect(sql).toContain("add column if not exists adjuster_share_expires_at");
    expect(sql).toContain("add column if not exists customer_share_token_hash");
    expect(sql).toContain("add column if not exists adjuster_share_token_hash");
    expect(sql).toContain("customer_share_token_hash = encode(extensions.digest(customer_share_token, 'sha256'), 'hex')");
    expect(sql).toContain("adjuster_share_token_hash = encode(extensions.digest(adjuster_share_token, 'sha256'), 'hex')");
    expect(sql).toContain("customer_share_token = null");
    expect(sql).toContain("adjuster_share_token = null");
  });

  it("removes permissive legal-document policies", () => {
    for (const policy of [
      "auth select legal docs",
      "auth insert legal docs",
      "auth update legal docs",
      "owner manager delete legal docs",
    ]) {
      expect(sql).toContain(`drop policy if exists "${policy}"`);
    }
    expect(sql).toContain('create policy "backoffice read legal docs"');
    expect(sql).toContain('create policy "backoffice update legal docs"');
    expect(sql).toContain('create policy "management delete legal docs"');
  });

  it("blocks owners from changing their own role or active flag", () => {
    expect(sql).toContain("create or replace function public.prevent_self_privilege_change");
    expect(sql).toContain("old.role is distinct from new.role");
    expect(sql).toContain("old.active is distinct from new.active");
  });
});
