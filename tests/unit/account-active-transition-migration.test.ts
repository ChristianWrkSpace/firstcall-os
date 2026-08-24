import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/040_account_active_transitions.sql"
);
const source = readFileSync(migrationPath, "utf8");
const sql = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n\r]*/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

function functionSql(name: string, signature: string): string {
  const marker = `create or replace function public.${name}(`;
  const start = sql.indexOf(marker);
  const bodyStart = sql.indexOf("$function$", start);
  const bodyEnd = sql.indexOf("$function$", bodyStart + "$function$".length);
  expect(start, `missing canonical function ${name}(${signature})`).toBeGreaterThanOrEqual(0);
  expect(bodyStart, `missing body for ${name}(${signature})`).toBeGreaterThan(start);
  expect(bodyEnd, `unterminated body for ${name}(${signature})`).toBeGreaterThan(bodyStart);
  return sql.slice(start, bodyEnd + "$function$".length);
}

const signatures = {
  claim: "uuid, boolean, uuid, uuid",
  acquire: "uuid, uuid, integer",
  record: "uuid, uuid, boolean, text, text",
  finalize: "uuid",
  closeInactive: "uuid, uuid",
  get: "uuid",
  list: "integer",
} as const;

const rpcNames = [
  ["claim_account_active_transition", signatures.claim],
  ["acquire_account_provider_work", signatures.acquire],
  ["record_account_provider_result", signatures.record],
  ["finalize_account_active_transition", signatures.finalize],
  ["close_account_active_transition_inactive", signatures.closeInactive],
  ["get_account_active_transition", signatures.get],
  ["list_recoverable_account_active_transitions", signatures.list],
] as const;

// This suite is intentionally static: PostgreSQL parsing and real concurrent
// execution remain unverified until the migration is exercised against a DB.
const runtimeVerification = false;

function expectOrdered(body: string, labels: Array<[string, string]>): void {
  let prior = -1;
  for (const [label, fragment] of labels) {
    const index = body.indexOf(fragment);
    expect(index, `missing ${label}`).toBeGreaterThanOrEqual(0);
    expect(index, `${label} must follow the prior protocol step`).toBeGreaterThan(prior);
    prior = index;
  }
}

function expectRedactedAudit(body: string): void {
  expect(body).toMatch(/insert into public\.audit_logs\s*\([^)]*user_name[^)]*details[^)]*\)\s*values\s*\([^;]+null[^;]+jsonb_build_object\s*\(/);
  const audit = body.match(/insert into public\.audit_logs\s*\([\s\S]*?;/)?.[0];
  expect(audit).toBeDefined();
  expect(audit).toContain("'transition_id'");
  expect(audit).toContain("'desired_active'");
  expect(audit).toContain("'transition_status'");
  expect(audit).toContain("'provider_state'");
  expect(audit).toContain("'error_code'");
  expect(audit).not.toMatch(/email|name'|raw|message|token|ip_address|metadata/);
}

describe("040 durable account-active transition migration", () => {
  it("defines the transition state machine and relational invariants", () => {
    const table = sql.match(/create table if not exists public\.account_active_transitions\s*\([\s\S]*?\);/)?.[0];
    expect(table).toBeDefined();
    expect(table).toMatch(/id uuid not null default gen_random_uuid\(\)/);
    expect(table).toMatch(/target_profile_id uuid not null/);
    expect(table).toMatch(/actor_id uuid/);
    expect(table).toMatch(/idempotency_key uuid not null/);
    expect(table).toMatch(/desired_active boolean not null/);
    for (const status of ["provider_pending", "provider_in_progress", "provider_failed", "provider_applied", "succeeded", "closed_inactive"]) {
      expect(table).toContain(`'${status}'`);
    }
    for (const state of ["unknown", "banned", "unbanned", "missing"]) {
      expect(table).toContain(`'${state}'`);
    }
    expect(table).toMatch(/attempt_count integer not null default 0/);
    expect(table).toMatch(/last_error_code text/);
    expect(table).toMatch(/constraint account_active_transitions_target_idempotency_key unique\s*\(target_profile_id, idempotency_key\)/);
    expect(table).toMatch(/\(status = 'provider_in_progress'\) = \(lease_token is not null and lease_expires_at is not null\)/);
    expect(table).toMatch(/status not in \('provider_applied', 'succeeded'\) or \( \(desired_active and provider_state = 'unbanned'\) or \(not desired_active and provider_state = 'banned'\) \)/);
    expect(table).toMatch(/\(status in \('succeeded', 'closed_inactive'\)\) = \(completed_at is not null\)/);
    expect(table).toMatch(/status <> 'closed_inactive' or desired_active = false/);
    expect(table).toMatch(/provider_observed_at timestamptz/);
    expect(table).toMatch(/created_at timestamptz not null default clock_timestamp\(\)/);
    expect(table).toMatch(/updated_at timestamptz not null default clock_timestamp\(\)/);
    expect(table).toMatch(/completed_at timestamptz/);
    for (const constraint of [
      "account_active_transitions_pkey",
      "account_active_transitions_target_profile_fkey",
      "account_active_transitions_actor_fkey",
      "account_active_transitions_target_idempotency_key",
      "account_active_transitions_status_check",
      "account_active_transitions_provider_state_check",
      "account_active_transitions_attempt_count_check",
      "account_active_transitions_error_code_check",
      "account_active_transitions_lease_check",
      "account_active_transitions_provider_applied_check",
      "account_active_transitions_completed_check",
      "account_active_transitions_closed_inactive_check",
    ]) {
      expect(table).toContain(`constraint ${constraint}`);
    }
  });

  it("defines idempotent open, recovery, and history indexes", () => {
    expect(sql).toMatch(/create unique index if not exists account_active_transitions_one_open_target on public\.account_active_transitions\s*\(target_profile_id\) where status not in \('succeeded', 'closed_inactive'\)/);
    expect(sql).toMatch(/create index if not exists account_active_transitions_recovery on public\.account_active_transitions\s*\(status, lease_expires_at, updated_at\)/);
    expect(sql).toMatch(/create index if not exists account_active_transitions_target_history on public\.account_active_transitions\s*\(target_profile_id, created_at desc\)/);
  });

  it("defines exact append-only event evidence without PII or raw errors", () => {
    const table = sql.match(/create table if not exists public\.account_active_transition_events\s*\([\s\S]*?\);/)?.[0];
    expect(table).toBeDefined();
    for (const event of ["claimed", "profile_deactivated", "provider_attempt_started", "provider_attempt_failed", "provider_confirmed", "profile_activated", "transition_succeeded", "recovery_resumed", "closed_inactive"]) {
      expect(table).toContain(`'${event}'`);
    }
    expect(table).toMatch(/transition_id uuid not null/);
    expect(table).toMatch(/attempt_number integer/);
    expect(table).toMatch(/error_code text/);
    expect(table).toMatch(/occurred_at timestamptz not null default clock_timestamp\(\)/);
    expect(table).not.toMatch(/email|user_name|raw_error|error_message|provider_message|lease_token|ip_address|metadata|jsonb/);
    expect(sql).toMatch(/create index if not exists account_active_transition_events_history on public\.account_active_transition_events\s*\(transition_id, occurred_at, id\)/);

    const immutable = functionSql("prevent_account_active_transition_event_mutation", "");
    expect(immutable).toMatch(/raise exception[^;]+errcode = '42501'/);
    expect(sql).toMatch(/create trigger account_active_transition_events_immutable before update or delete on public\.account_active_transition_events for each row execute function public\.prevent_account_active_transition_event_mutation\(\)/);
    for (const constraint of [
      "account_active_transition_events_pkey",
      "account_active_transition_events_transition_fkey",
      "account_active_transition_events_type_check",
      "account_active_transition_events_attempt_check",
      "account_active_transition_events_provider_state_check",
      "account_active_transition_events_error_code_check",
    ]) {
      expect(table).toContain(`constraint ${constraint}`);
    }
  });

  it("enables RLS, revokes every direct table role, and creates no policy", () => {
    for (const table of ["account_active_transitions", "account_active_transition_events"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated, service_role`);
      expect(sql).not.toMatch(new RegExp(`create policy[^;]+public\\.${table}`));
      expect(sql).not.toMatch(new RegExp(`grant (?:select|insert|update|delete|all)[^;]+public\\.${table}`));
    }
  });

  it("guards every profile active change, including service-role writes", () => {
    const guard = functionSql("guard_profile_active_transition", "");
    expect(guard).toContain("new.active is not distinct from old.active");
    expect(guard).toMatch(/old\.active is true and new\.active is false[\s\S]*desired_active = false[\s\S]*status = 'provider_pending'/);
    expect(guard).toMatch(/old\.active is false and new\.active is true[\s\S]*desired_active = true[\s\S]*status = 'provider_applied'[\s\S]*provider_state = 'unbanned'/);
    expect(guard).toMatch(/status not in \('succeeded', 'closed_inactive'\)/);
    expect(guard).toMatch(/raise exception[^;]+errcode = '42501'/);
    expect(sql).toMatch(/create trigger profiles_active_transition_guard before update of active on public\.profiles for each row execute function public\.guard_profile_active_transition\(\)/);
    expect(sql).not.toMatch(/when\s*\([^)]*(?:current_user|session_user|service_role)/);
  });

  it("exposes only canonical security-definer service-role RPC signatures", () => {
    const declarations: Record<string, RegExp> = {
      claim_account_active_transition: /claim_account_active_transition\s*\(\s*p_target_profile_id uuid,\s*p_desired_active boolean,\s*p_idempotency_key uuid,\s*p_actor_id uuid\s*\)/,
      acquire_account_provider_work: /acquire_account_provider_work\s*\(\s*p_transition_id uuid,\s*p_worker_token uuid,\s*p_lease_seconds integer default 60\s*\)/,
      record_account_provider_result: /record_account_provider_result\s*\(\s*p_transition_id uuid,\s*p_worker_token uuid,\s*p_succeeded boolean,\s*p_provider_state text,\s*p_error_code text default null\s*\)/,
      finalize_account_active_transition: /finalize_account_active_transition\s*\(\s*p_transition_id uuid\s*\)/,
      close_account_active_transition_inactive: /close_account_active_transition_inactive\s*\(\s*p_transition_id uuid,\s*p_actor_id uuid\s*\)/,
      get_account_active_transition: /get_account_active_transition\s*\(\s*p_transition_id uuid\s*\)/,
      list_recoverable_account_active_transitions: /list_recoverable_account_active_transitions\s*\(\s*p_limit integer default 25\s*\)/,
    };
    for (const [name, signature] of rpcNames) {
      const body = functionSql(name, signature);
      expect(body).toMatch(declarations[name]);
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = ''");
      expect(sql).toContain(`revoke all on function public.${name}(${signature}) from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${name}(${signature}) to service_role`);
      expect(sql).not.toMatch(new RegExp(`grant execute on function public\\.${name}\\(${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\) to (?:public|anon|authenticated)`));
    }
  });

  it("claims under the canonical target-advisory then deterministic-profile then transition lock protocol", () => {
    const body = functionSql("claim_account_active_transition", signatures.claim);
    expect(body).toMatch(/if not p_desired_active and p_actor_id = p_target_profile_id[\s\S]*raise exception/);
    expectOrdered(body, [
      ["target advisory lock", "pg_catalog.pg_advisory_xact_lock("],
      ["deterministic actor and target profile locks", "order by p.id asc for update"],
      ["locked owner authorization", "account_transition_actor_forbidden"],
      ["idempotency transition lock", "and t.idempotency_key = p_idempotency_key for update"],
      ["open transition lock", "and t.status not in ('succeeded', 'closed_inactive') for update"],
    ]);
    expect(body).toMatch(/where p\.id in \(p_actor_id, p_target_profile_id\) order by p\.id asc for update/);
    expect(body).toMatch(/v_profile\.id = p_actor_id[\s\S]*v_actor_role := v_profile\.role[\s\S]*v_actor_active := v_profile\.active/);
    expect(body).toMatch(/v_actor_role is distinct from 'owner'[\s\S]*v_actor_active is distinct from true/);
    expect(body).toMatch(/if not v_target_found then[\s\S]*errcode = 'p0002'/);
    expect(body).toMatch(/where t\.target_profile_id = p_target_profile_id and t\.idempotency_key = p_idempotency_key/);
    expect(body).toMatch(/desired_active is distinct from p_desired_active[\s\S]*account_transition_idempotency_conflict/);
    expect(body).toMatch(/status not in \('succeeded', 'closed_inactive'\)[\s\S]*account_transition_conflict/);
    expect(body).toMatch(/insert into public\.account_active_transitions[^;]+returning \* into/);
    expect(body).toMatch(/insert into public\.account_active_transition_events[^;]+'claimed'/);
    const update = body.match(/update public\.profiles set active = false[^;]+;/)?.[0];
    expect(update).toMatch(/where id = p_target_profile_id and active is distinct from false returning id into v_updated_id/);
    expect(body).toMatch(/returning id into v_updated_id; if not found then raise exception 'account_transition_profile_deactivation_failed'/);
    expect(body.indexOf("'profile_deactivated'")).toBeGreaterThan(
      body.indexOf("account_transition_profile_deactivation_failed")
    );
    expectRedactedAudit(body);
  });

  it("emits claim evidence only inside the new-transition branch", () => {
    const body = functionSql("claim_account_active_transition", signatures.claim);
    const createIndex = body.indexOf("insert into public.account_active_transitions");
    const branchEnd = body.indexOf(
      "select p.active into v_profile_active from public.profiles p where p.id = p_target_profile_id",
      createIndex
    );
    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(branchEnd).toBeGreaterThan(createIndex);
    for (const fragment of ["'claimed'", "'profile_deactivated'", "'account_active_transition_claimed'"]) {
      const evidenceIndex = body.indexOf(fragment, createIndex);
      expect(evidenceIndex, `${fragment} must be in the create branch`).toBeGreaterThan(createIndex);
      expect(evidenceIndex, `${fragment} must not replay for an existing transition`).toBeLessThan(branchEnd);
    }
    expect(body.indexOf("'account_active_transition_claimed'", branchEnd)).toBe(-1);
  });

  it("locks every transition mutator only after an immutable snapshot, target advisory, and profile row", () => {
    for (const [name, signature] of [
      ["acquire_account_provider_work", signatures.acquire],
      ["record_account_provider_result", signatures.record],
      ["finalize_account_active_transition", signatures.finalize],
    ] as const) {
      const body = functionSql(name, signature);
      expectOrdered(body, [
        ["unlocked immutable target/actor snapshot", "select t.target_profile_id, t.actor_id into v_target_profile_id, v_transition_actor_id"],
        ["target advisory lock", "pg_catalog.pg_advisory_xact_lock("],
        ["deterministic actor and target profile locks", "where p.id in (v_transition_actor_id, v_target_profile_id) order by p.id asc for update"],
        ["transition row lock", "where t.id = p_transition_id for update"],
      ]);
      const snapshotEnd = body.indexOf(";", body.indexOf("select t.target_profile_id"));
      expect(body.slice(body.indexOf("select t.target_profile_id"), snapshotEnd)).not.toContain("for update");
      expect(body.indexOf("where t.id = p_transition_id for update")).toBeGreaterThan(body.indexOf("where p.id in (v_transition_actor_id, v_target_profile_id) order by p.id asc for update"));
    }
  });

  it("leases provider work with row locks, recovery evidence, and explicit timestamps", () => {
    const body = functionSql("acquire_account_provider_work", signatures.acquire);
    expect(body).toMatch(/p_lease_seconds is null or p_lease_seconds < 1 or p_lease_seconds > 900/);
    expect(body).toMatch(/(?:v_transition\.)?status = 'provider_in_progress' and (?:v_transition\.)?lease_expires_at > clock_timestamp\(\)[\s\S]*account_transition_lease_active/);
    expect(body).toMatch(/(?:v_transition\.)?status in \('succeeded', 'closed_inactive', 'provider_applied'\)[\s\S]*raise exception/);
    expect(body).toMatch(/(?:v_transition\.)?status = 'provider_in_progress'[\s\S]*(?:v_transition\.)?lease_expires_at <= clock_timestamp\(\)[\s\S]*'recovery_resumed'/);
    expect(body).toMatch(/update public\.account_active_transitions set status = 'provider_in_progress', attempt_count = attempt_count \+ 1, lease_token = p_worker_token, lease_expires_at = clock_timestamp\(\) \+ pg_catalog\.make_interval\(secs => p_lease_seconds\), updated_at = clock_timestamp\(\)/);
    expect(body).toContain("'provider_attempt_started'");
    expectRedactedAudit(body);
  });

  it("records only verified provider outcomes and allowlisted sanitized failures", () => {
    const body = functionSql("record_account_provider_result", signatures.record);
    expect(body).toMatch(/v_transition\.status <> 'provider_in_progress' or v_transition\.lease_token is distinct from p_worker_token or v_transition\.lease_expires_at <= clock_timestamp\(\)/);
    expect(body).toMatch(/p_succeeded[\s\S]*desired_active and p_provider_state <> 'unbanned'/);
    expect(body).toMatch(/p_succeeded[\s\S]*not[^;]+desired_active and p_provider_state <> 'banned'/);
    expect(body).toMatch(/p_error_code not in \(\s*'provider_timeout', 'provider_unavailable', 'provider_rate_limited', 'provider_rejected', 'provider_user_missing', 'provider_response_unverified'\s*\)/);
    const successUpdate = body.match(/update public\.account_active_transitions set status = 'provider_applied'[^;]+;/)?.[0] ?? "";
    for (const assignment of ["provider_state = p_provider_state", "provider_observed_at = clock_timestamp()", "lease_token = null", "lease_expires_at = null", "last_error_code = null", "updated_at = clock_timestamp()"]) {
      expect(successUpdate).toContain(assignment);
    }
    const failureUpdate = body.match(/update public\.account_active_transitions set status = 'provider_failed'[^;]+;/)?.[0] ?? "";
    for (const assignment of ["provider_state = p_provider_state", "last_error_code = p_error_code", "lease_token = null", "lease_expires_at = null", "updated_at = clock_timestamp()"]) {
      expect(failureUpdate).toContain(assignment);
    }
    expect(body).toContain("'provider_confirmed'");
    expect(body).toContain("'provider_attempt_failed'");
    expect(body).not.toMatch(/p_(?:raw|message|email|name|ip|token)(?!worker_token)/);
    expectRedactedAudit(body);
  });

  it("finalizes only matching provider-applied state with locked CAS and exact-row verification", () => {
    const body = functionSql("finalize_account_active_transition", signatures.finalize);
    expect(body).toMatch(/pg_advisory_xact_lock\s*\(\s*pg_catalog\.hashtextextended\(v_target_profile_id::text, 0\)\s*\)/);

    expect(body).toMatch(/status <> 'provider_applied'/);
    expect(body).toMatch(/v_transition\.desired_active and v_transition\.provider_state <> 'unbanned'/);
    expect(body).toMatch(/not v_transition\.desired_active and v_transition\.provider_state <> 'banned'/);
    expect(body).toMatch(/not v_transition\.desired_active[\s\S]*v_profile_active is distinct from false[\s\S]*raise exception/);
    expect(body).toMatch(/update public\.profiles set active = true where id = v_transition\.target_profile_id and active is distinct from true returning id into/);
    expect(body).toMatch(/returning id into v_updated_id; if found then v_profile_active := true;[\s\S]*elsif v_profile_active is distinct from true then raise exception 'account_transition_profile_activation_failed'/);
    expect(body).toContain("'profile_activated'");
    expect(body).toMatch(/update public\.account_active_transitions set status = 'succeeded', completed_at = clock_timestamp\(\), lease_token = null, lease_expires_at = null, last_error_code = null, updated_at = clock_timestamp\(\)/);
    expect(body).toContain("'transition_succeeded'");
    expectRedactedAudit(body);
  });

  it("returns authoritative snapshots and bounded oldest-first recovery candidates", () => {
    const get = functionSql("get_account_active_transition", signatures.get);
    expect(get).toMatch(/join public\.profiles[^;]+p\.id = t\.target_profile_id/);
    for (const field of ["t.id", "t.target_profile_id", "t.desired_active", "t.status", "p.active", "t.provider_state", "t.provider_observed_at", "t.attempt_count", "t.last_error_code"]) {
      expect(get).toContain(field);
    }

    const list = functionSql("list_recoverable_account_active_transitions", signatures.list);
    expect(list).toMatch(/greatest\(1, least\(coalesce\(p_limit, 25\), 100\)\)/);
    expect(list).toMatch(/t\.status in \('provider_pending', 'provider_failed', 'provider_applied'\) or \(t\.status = 'provider_in_progress' and t\.lease_expires_at <= clock_timestamp\(\)\)/);
    expect(list).toMatch(/order by t\.updated_at asc, t\.id asc/);
    expect(list).not.toMatch(/order by updated_at asc|, id asc/);
    expect(list).toMatch(/limit v_limit/);
    expect(list).not.toMatch(/update public\.account_active_transitions|lease_token\s*=/);
  });

  it("closes only the narrow provider-missing inactive case with locked owner authorization", () => {
    const body = functionSql("close_account_active_transition_inactive", signatures.closeInactive);
    expectOrdered(body, [
      ["unlocked immutable target/actor snapshot", "select t.target_profile_id, t.actor_id into v_target_profile_id, v_transition_actor_id"],
      ["target advisory lock", "pg_catalog.pg_advisory_xact_lock("],
      ["deterministic actor and target profile locks", "order by p.id asc for update"],
      ["transition row lock", "where t.id = p_transition_id for update"],
      ["locked owner authorization", "account_transition_actor_forbidden"],
    ]);
    expect(body).toMatch(/v_transition\.desired_active is distinct from false/);
    expect(body).toMatch(/v_profile_active is distinct from false/);
    expect(body).toMatch(/v_transition\.status <> 'provider_failed'/);
    expect(body).toMatch(/v_transition\.provider_state <> 'missing'/);
    expect(body).toMatch(/v_transition\.last_error_code is distinct from 'provider_user_missing'/);
    expect(body).toMatch(/v_actor_role is distinct from 'owner' or v_actor_active is distinct from true[\s\S]*account_transition_actor_forbidden/);
    expect(body.indexOf("account_transition_actor_forbidden")).toBeGreaterThan(body.indexOf("order by p.id asc for update"));
    expect(body).toMatch(/update public\.account_active_transitions set status = 'closed_inactive', completed_at = clock_timestamp\(\), lease_token = null, lease_expires_at = null, updated_at = clock_timestamp\(\)/);
    expect(body).toContain("'closed_inactive'");
    expectRedactedAudit(body);
    expect(sql).not.toMatch(/create or replace function public\.cancel_account_active_transition/);
    expect(sql).not.toMatch(/delete from public\.account_active_transition/);
  });

  it("fails closed on replay drift through a complete catalog-verification footer", () => {
    const footer = sql.match(/do \$verification\$[\s\S]*?\$verification\$;/)?.[0];
    expect(footer).toBeDefined();
    for (const catalog of ["pg_catalog.pg_attribute", "pg_catalog.pg_constraint", "pg_catalog.pg_class", "pg_catalog.pg_index", "pg_catalog.pg_proc", "pg_catalog.pg_trigger"]) {
      expect(footer).toContain(catalog);
    }
    expect(footer).toContain("pg_catalog.pg_get_constraintdef");
    expect(footer).toContain("pg_catalog.pg_get_indexdef");
    expect(footer).toContain("c.convalidated");
    expect(footer).toContain("c.relrowsecurity");
    expect(footer).toContain("pg_catalog.pg_get_userbyid(c.relowner) <> current_user");
    expect(footer).toMatch(/pg_catalog\.pg_get_userbyid\(p\.proowner\) (?:=|<>) current_user/);
    expect(footer).toContain("pg_catalog.oidvectortypes(p.proargtypes)");
    expect(footer).toContain("c.conrelid = pg_catalog.to_regclass(");
    expect(footer).toContain("pg_catalog.format_type(a.atttypid, a.atttypmod)");
    expect(footer).toContain("a.attnotnull");
    expect(footer).toContain("a.attidentity = ''");
    expect(footer).toContain("a.attgenerated = ''");
    expect(footer).toContain("pg_catalog.pg_get_expr(d.adbin, d.adrelid)");
    expect(footer).toContain("replace(v_actual, 'references public.', 'references ')");
    expect(footer).toContain("pg_catalog.aclexplode");
    expect(footer).toContain("pg_catalog.pg_policy");
    expect(footer).toContain("unexpected account transition trigger drift");
    expect(footer).toContain("if v_count <> 1");
    expect(footer).toContain("not v_validated");
    expect(footer).toMatch(/tgname in \('account_active_transition_events_immutable', 'profiles_active_transition_guard'\)[\s\S]*tgenabled <> 'o'/);
    for (const constraint of ["account_active_transitions_lease_check", "account_active_transitions_provider_applied_check", "account_active_transition_events_type_check"]) {
      expect(footer).toContain(`'${constraint}'`);
    }
    for (const index of ["account_active_transitions_one_open_target", "account_active_transitions_recovery", "account_active_transitions_target_history", "account_active_transition_events_history"]) {
      expect(footer).toContain(`'${index}'`);
    }
    for (const [name, signature] of rpcNames) {
      expect(sql).toContain(`drop function if exists public.${name}(${signature});`);
      expect(footer).toContain(`'${name}'`);
      expect(footer).toContain(`'${signature}'`);
    }
    expect(runtimeVerification).toBe(false);
  });

  it("contains complete static statements but does not claim parser or concurrency execution", () => {
    expect((sql.match(/create or replace function public\./g) ?? []).length).toBe(9);
    expect((sql.match(/\$function\$;/g) ?? []).length).toBe(9);
    expect(sql.endsWith("$verification$;")).toBe(true);
    expect(runtimeVerification).toBe(false);
  });

  it("contains no false-pass prose or forbidden raw/PII persistence", () => {
    expect(source).not.toMatch(/(?:test|assertion|contract).*(?:pass|satisf|expect)/i);
    const tables = sql.match(/create table if not exists public\.account_active_transition(?:s|_events)[\s\S]*?\);/g)?.join(" ") ?? "";
    expect(tables).not.toMatch(/\b(email|name|raw_error|error_message|provider_message|ip_address|metadata|payload|lease_owner)\b/);
  });
});
