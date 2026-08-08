import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/034_manual_job_billing_amount.sql"
);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/\s+/g, " ").toLowerCase();

describe("034 manual job billing amount migration", () => {
  it("prevents technicians from setting or changing the financial amount at the database boundary", () => {
    expect(normalized).toContain(
      "create or replace function public.prevent_unauthorized_job_amount_change()"
    );
    expect(normalized).toContain("tg_op = 'insert'");
    expect(normalized).toContain("new.estimated_value is not null");
    expect(normalized).toContain("old.estimated_value is distinct from new.estimated_value");
    expect(normalized).toMatch(
      /not coalesce\(\s*public\.current_user_role\(\) in \('owner', 'manager', 'office'\),\s*false\s*\)/
    );
    expect(normalized).toContain("auth.uid() is not null");
    expect(normalized).toContain("before insert on public.jobs");
    expect(normalized).toContain("before update of estimated_value on public.jobs");
  });
});
