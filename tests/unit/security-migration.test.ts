import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/031_security_hardening.sql"
);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/\s+/g, " ").toLowerCase();

describe("031 security hardening migration", () => {
  it("idempotently removes every known self-update profile policy", () => {
    expect(normalized).toContain(
      'drop policy if exists "users update own profile" on public.profiles'
    );
    expect(normalized).toContain(
      'drop policy if exists "self update profiles" on public.profiles'
    );
    expect(normalized).not.toMatch(/create policy "(?:users update own profile|self update profiles)"/);
  });

  it("makes authentication and role helpers active-profile aware", () => {
    expect(normalized).toMatch(
      /create or replace function public\.current_user_role\(\).*?active is true/
    );
    expect(normalized).toMatch(
      /create or replace function public\.is_authenticated\(\).*?active is true/
    );
  });

  it("keeps profile administration owner-only", () => {
    expect(normalized).toContain(
      'drop policy if exists "owner update profiles" on public.profiles'
    );
    expect(normalized).toMatch(
      /create policy "owner update profiles".*?for update.*?current_user_role\(\) = 'owner'/
    );
  });

  it("exposes only a hardened name/avatar self-update RPC", () => {
    expect(normalized).toMatch(
      /create or replace function public\.update_own_profile\(.*?security definer/
    );
    expect(normalized).toMatch(
      /update public\.profiles set name = .*?avatar_url = .*?where id = auth\.uid\(\)/
    );
    const profileUpdate = normalized.match(/update public\.profiles set ([^;]+);/)?.[1];
    expect(profileUpdate).toBeDefined();
    expect(profileUpdate).not.toMatch(/(?:role|active)\s*=/);
    expect(normalized).toContain(
      "revoke all on function public.update_own_profile(text, text) from public"
    );
    expect(normalized).toContain(
      "grant execute on function public.update_own_profile(text, text) to authenticated"
    );
  });
});
