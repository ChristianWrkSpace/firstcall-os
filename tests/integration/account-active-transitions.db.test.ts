import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const BIN = "/opt/homebrew/bin";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ID = "11111111-1111-4111-8111-111111111111";
let clusterDir = "";
let connectionString = "";
let admin: Client;

function assertDisposableLocalOnly(url: string) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to run account transition DB tests in production.");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.username !== "postgres") {
    throw new Error("Refusing non-local or non-disposable PostgreSQL target.");
  }
  if (!clusterDir.startsWith(path.join(tmpdir(), "firstcall-account-active-pg-"))) {
    throw new Error("Refusing PostgreSQL cluster outside the disposable temp root.");
  }
}

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No local port"));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function client() {
  assertDisposableLocalOnly(connectionString);
  const value = new Client({ connectionString });
  await value.connect();
  return value;
}

async function claim(db: Client, desired: boolean, key = randomUUID(), target = TARGET_ID) {
  return db.query(
    "select * from public.claim_account_active_transition($1, $2, $3, $4)",
    [target, desired, key, OWNER_ID]
  );
}

async function acquire(db: Client, transitionId: string, token = randomUUID(), seconds = 60) {
  return db.query(
    "select * from public.acquire_account_provider_work($1, $2, $3)",
    [transitionId, token, seconds]
  );
}

async function record(
  db: Client,
  transitionId: string,
  token: string,
  succeeded: boolean,
  state: string,
  errorCode: string | null = null
) {
  return db.query(
    "select * from public.record_account_provider_result($1, $2, $3, $4, $5)",
    [transitionId, token, succeeded, state, errorCode]
  );
}

class Barrier {
  private waiting = 0;
  private release!: () => void;
  private readonly ready = new Promise<void>((resolve) => { this.release = resolve; });
  constructor(private readonly parties: number) {}
  async wait() {
    this.waiting += 1;
    if (this.waiting === this.parties) this.release();
    await this.ready;
  }
}

beforeAll(async () => {
  if (process.env.ACCOUNT_ACTIVE_TRANSITIONS_TEST_DATABASE_URL) {
    throw new Error("External database URLs are forbidden; this suite always creates its own local cluster.");
  }
  clusterDir = mkdtempSync(path.join(tmpdir(), "firstcall-account-active-pg-"));
  const port = await freePort();
  connectionString = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  assertDisposableLocalOnly(connectionString);

  const environment = { ...process.env, LC_ALL: "C", LANG: "C" };
  const logPath = path.join(clusterDir, "postgres.log");
  execFileSync(path.join(BIN, "initdb"), ["-D", clusterDir, "-A", "trust", "-U", "postgres", "--no-locale"], { stdio: "pipe", env: environment });
  execFileSync(path.join(BIN, "pg_ctl"), ["-D", clusterDir, "-l", logPath, "-o", `-F -p ${port} -h 127.0.0.1`, "-w", "start"], { stdio: "pipe", env: environment });

  admin = await client();
  await admin.query(`
    create extension if not exists pgcrypto;
    do $$ begin
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
    exception when duplicate_object then null;
    end $$;
    create table public.profiles (
      id uuid primary key,
      role text not null,
      active boolean not null default true,
      name text,
      email text
    );
    create table public.audit_logs (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      user_id uuid references public.profiles(id) on delete set null,
      user_name text,
      action text not null,
      entity_type text,
      entity_id uuid,
      details jsonb default '{}',
      ip_address text
    );
  `);
  const migration = readFileSync("supabase/migrations/040_account_active_transitions.sql", "utf8");
  await admin.query(migration);
});

afterAll(async () => {
  await admin?.end().catch(() => undefined);
  if (clusterDir) {
    execFileSync(path.join(BIN, "pg_ctl"), ["-D", clusterDir, "-m", "immediate", "-w", "stop"], { stdio: "pipe" });
    rmSync(clusterDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  assertDisposableLocalOnly(connectionString);
  await admin.query("truncate public.account_active_transition_events, public.account_active_transitions, public.audit_logs, public.profiles cascade");
  await admin.query(
    "insert into public.profiles(id, role, active, name) values ($1, 'owner', true, 'Owner'), ($2, 'technician', true, 'Target')",
    [OWNER_ID, TARGET_ID]
  );
});

describe("durable account-active transitions on disposable local PostgreSQL", () => {
  it("serializes simultaneous opposite claims to one open transition and one typed conflict", async () => {
    const a = await client();
    const b = await client();
    const barrier = new Barrier(2);
    try {
      const results = await Promise.allSettled([
        (async () => { await barrier.wait(); return claim(a, true); })(),
        (async () => { await barrier.wait(); return claim(b, false); })(),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejection = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      expect(rejection?.reason).toMatchObject({ code: "P0001" });
      expect(String(rejection?.reason?.message)).toContain("account_transition_conflict");
      const open = await admin.query("select count(*)::int as count from public.account_active_transitions where status not in ('succeeded', 'closed_inactive')");
      expect(open.rows[0].count).toBe(1);
    } finally { await Promise.all([a.end(), b.end()]); }
  });

  it("prevents opposite transitions from both reaching succeeded", async () => {
    const first = await claim(admin, false);
    const transitionId = first.rows[0].transition_id;
    await expect(claim(admin, true)).rejects.toMatchObject({ code: "P0001" });
    const token = randomUUID();
    await acquire(admin, transitionId, token);
    await record(admin, transitionId, token, true, "banned");
    await admin.query("select * from public.finalize_account_active_transition($1)", [transitionId]);
    const rows = await admin.query("select desired_active, status from public.account_active_transitions");
    expect(rows.rows).toEqual([{ desired_active: false, status: "succeeded" }]);
  });

  it("returns one transition for repeated same-key claims", async () => {
    const key = randomUUID();
    const first = await claim(admin, false, key);
    const second = await claim(admin, false, key);
    expect(second.rows[0].transition_id).toBe(first.rows[0].transition_id);
    const count = await admin.query("select count(*)::int as count from public.account_active_transitions");
    expect(count.rows[0].count).toBe(1);
  });

  it("allows only one worker to acquire a live provider lease", async () => {
    const transitionId = (await claim(admin, false)).rows[0].transition_id;
    const a = await client();
    const b = await client();
    const barrier = new Barrier(2);
    try {
      const results = await Promise.allSettled([
        (async () => { await barrier.wait(); return acquire(a, transitionId); })(),
        (async () => { await barrier.wait(); return acquire(b, transitionId); })(),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    } finally { await Promise.all([a.end(), b.end()]); }
  });

  it("recovers an expired lease with a fresh worker and recovery evidence", async () => {
    const transitionId = (await claim(admin, false)).rows[0].transition_id;
    await acquire(admin, transitionId, randomUUID(), 1);
    await admin.query("update public.account_active_transitions set lease_expires_at = clock_timestamp() - interval '1 second' where id = $1", [transitionId]);
    const recovered = await acquire(admin, transitionId, randomUUID(), 60);
    expect(recovered.rows[0].attempt_number).toBe(2);
    const event = await admin.query("select count(*)::int as count from public.account_active_transition_events where transition_id = $1 and event_type = 'recovery_resumed'", [transitionId]);
    expect(event.rows[0].count).toBe(1);
  });

  it("rejects stale and wrong worker tokens when recording provider results", async () => {
    const transitionId = (await claim(admin, false)).rows[0].transition_id;
    const correct = randomUUID();
    await acquire(admin, transitionId, correct);
    await expect(record(admin, transitionId, randomUUID(), true, "banned")).rejects.toMatchObject({ code: "55000" });
    await admin.query("update public.account_active_transitions set lease_expires_at = clock_timestamp() - interval '1 second' where id = $1", [transitionId]);
    const fresh = randomUUID();
    await acquire(admin, transitionId, fresh);
    await expect(record(admin, transitionId, correct, true, "banned")).rejects.toMatchObject({ code: "55000" });
  });

  it("cannot finalize activation before an unbanned provider confirmation", async () => {
    await admin.query("update public.profiles set active = false where id = $1", [TARGET_ID]).catch(() => undefined);
    // Establish inactive state without bypassing the guard by completing a real deactivation first.
    if ((await admin.query("select active from public.profiles where id = $1", [TARGET_ID])).rows[0].active) {
      const deactivationId = (await claim(admin, false)).rows[0].transition_id;
      const banToken = randomUUID();
      await acquire(admin, deactivationId, banToken);
      await record(admin, deactivationId, banToken, true, "banned");
      await admin.query("select * from public.finalize_account_active_transition($1)", [deactivationId]);
    }
    const activationId = (await claim(admin, true)).rows[0].transition_id;
    const token = randomUUID();
    await acquire(admin, activationId, token);
    await expect(record(admin, activationId, token, true, "banned")).rejects.toMatchObject({ code: "22023" });
    await expect(admin.query("select * from public.finalize_account_active_transition($1)", [activationId])).rejects.toMatchObject({ code: "55000" });
    const profile = await admin.query("select active from public.profiles where id = $1", [TARGET_ID]);
    expect(profile.rows[0].active).toBe(false);
  });

  it("blocks direct profile activation without matching provider_applied evidence", async () => {
    const deactivationId = (await claim(admin, false)).rows[0].transition_id;
    const token = randomUUID();
    await acquire(admin, deactivationId, token);
    await record(admin, deactivationId, token, true, "banned");
    await admin.query("select * from public.finalize_account_active_transition($1)", [deactivationId]);
    await expect(admin.query("update public.profiles set active = true where id = $1", [TARGET_ID])).rejects.toMatchObject({ code: "42501" });
  });

  it("fails nonexistent targets and stale finalize state rather than returning success", async () => {
    await expect(claim(admin, false, randomUUID(), randomUUID())).rejects.toMatchObject({ code: "P0002" });
    const transitionId = (await claim(admin, false)).rows[0].transition_id;
    const token = randomUUID();
    await acquire(admin, transitionId, token);
    await record(admin, transitionId, token, true, "banned");
    await admin.query("alter table public.profiles disable trigger profiles_active_transition_guard");
    await admin.query("update public.profiles set active = true where id = $1", [TARGET_ID]);
    await admin.query("alter table public.profiles enable trigger profiles_active_transition_guard");
    await expect(admin.query("select * from public.finalize_account_active_transition($1)", [transitionId])).rejects.toMatchObject({ code: "55000" });
  });

  it("rejects a stale completed key after a newer opposite transition succeeds", async () => {
    const deactivationKey = randomUUID();
    const deactivationId = (await claim(admin, false, deactivationKey)).rows[0].transition_id;
    const banToken = randomUUID();
    await acquire(admin, deactivationId, banToken);
    await record(admin, deactivationId, banToken, true, "banned");
    await admin.query("select * from public.finalize_account_active_transition($1)", [deactivationId]);

    const activationId = (await claim(admin, true)).rows[0].transition_id;
    const unbanToken = randomUUID();
    await acquire(admin, activationId, unbanToken);
    await record(admin, activationId, unbanToken, true, "unbanned");
    await admin.query("select * from public.finalize_account_active_transition($1)", [activationId]);

    await expect(claim(admin, false, deactivationKey)).rejects.toMatchObject({ code: "P0001" });
    const latest = await admin.query("select * from public.get_account_active_transition_for_target($1)", [TARGET_ID]);
    expect(latest.rows[0]).toMatchObject({
      transition_id: activationId,
      desired_active: true,
      transition_status: "succeeded",
      profile_active: true,
      provider_state: "unbanned",
    });
  });

  it("records immutable append-only evidence for partial provider failures", async () => {
    const transitionId = (await claim(admin, false)).rows[0].transition_id;
    const token = randomUUID();
    await acquire(admin, transitionId, token);
    await record(admin, transitionId, token, false, "unknown", "provider_unavailable");
    const events = await admin.query("select event_type, error_code from public.account_active_transition_events where transition_id = $1 order by occurred_at, id", [transitionId]);
    expect(events.rows.map((row) => row.event_type)).toEqual(expect.arrayContaining(["claimed", "profile_deactivated", "provider_attempt_started", "provider_attempt_failed"]));
    expect(events.rows.find((row) => row.event_type === "provider_attempt_failed")?.error_code).toBe("provider_unavailable");
    await expect(admin.query("update public.account_active_transition_events set error_code = null where transition_id = $1", [transitionId])).rejects.toMatchObject({ code: "42501" });
    await expect(admin.query("delete from public.account_active_transition_events where transition_id = $1", [transitionId])).rejects.toMatchObject({ code: "42501" });
  });
});
