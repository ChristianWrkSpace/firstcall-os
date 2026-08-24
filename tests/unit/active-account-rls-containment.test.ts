import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/039_active_account_rls_containment.sql"
);
const sql = readFileSync(migrationPath, "utf8");
const executableSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "");
const normalized = executableSql.replace(/\s+/g, " ").trim().toLowerCase();

const legacyPolicies = [
  ["outreach_leads", "auth all outreach leads"],
  ["outreach_messages", "auth all outreach messages"],
  ["moisture_readings", "auth all moisture readings"],
  ["audit_logs", "auth read audit"],
  ["solomon_reports", "auth all solomon"],
  ["backups_log", "auth select backups"],
  ["partner_payouts", "auth all partner payouts"],
  ["partner_investments", "auth all partner investments"],
  ["echo_conversations", "auth read echo"],
  ["echo_conversations", "auth insert echo"],
  ["echo_conversations", "auth update echo feedback"],
  ["job_videos", "auth all job videos"],
] as const;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function policyStatement(table: string, policy: string) {
  expect(normalized).toContain(
    `drop policy if exists "${policy}" on public.${table};`
  );
  const match = normalized.match(
    new RegExp(
      `create policy "${escapeRegex(policy)}" on public\\.${escapeRegex(table)} for (select|insert|update|delete) to authenticated ([^;]+);`
    )
  );
  expect(match, `missing policy ${policy} on ${table}`).not.toBeNull();
  const expression = match![2]
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
  return { command: match![1], expression };
}

function expectPolicy(
  table: string,
  policy: string,
  command: "select" | "insert" | "update" | "delete",
  predicate: string
) {
  const statement = policyStatement(table, policy);
  expect(statement.command).toBe(command);

  if (command === "insert") {
    expect(statement.expression).toBe(`with check (${predicate})`);
  } else if (command === "update") {
    expect(statement.expression).toBe(
      `using (${predicate}) with check (${predicate})`
    );
  } else {
    expect(statement.expression).toBe(`using (${predicate})`);
  }
}

function createdPoliciesFor(table: string) {
  return [...normalized.matchAll(
    new RegExp(`create policy "([^"]+)" on public\\.${escapeRegex(table)} for `, "g")
  )].map((match) => match[1]);
}

const backoffice =
  "coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)";
const management =
  "coalesce(public.current_user_role() in ('owner', 'manager'), false)";
const jobAccess =
  "coalesce(public.can_access_job_storage(job_id::text), false)";
const ownEcho = "public.is_authenticated() and user_id = auth.uid()";

describe("039 active-account RLS containment", () => {
  it("idempotently drops every historical broad authenticated policy", () => {
    expect(legacyPolicies).toHaveLength(12);
    for (const [table, policy] of legacyPolicies) {
      expect(normalized).toContain(
        `drop policy if exists "${policy}" on public.${table};`
      );
    }
  });

  it("replaces outreach policies with active backoffice command policies", () => {
    for (const [table, noun] of [
      ["outreach_leads", "outreach leads"],
      ["outreach_messages", "outreach messages"],
    ] as const) {
      for (const command of ["select", "insert", "update", "delete"] as const) {
        const verb = command === "select" ? "read" : command;
        expectPolicy(table, `active backoffice ${verb} ${noun}`, command, backoffice);
      }
    }
  });

  it("scopes every moisture-reading command to active job access", () => {
    for (const command of ["select", "insert", "update", "delete"] as const) {
      const verb = command === "select" ? "read" : command;
      expectPolicy(
        "moisture_readings",
        `active job users ${verb} moisture readings`,
        command,
        jobAccess
      );
    }
  });

  it("keeps audit history append-only and readable by the supported activity roles", () => {
    expectPolicy("audit_logs", "active audit viewers read audit", "select", backoffice);
    expect(normalized).not.toContain('drop policy if exists "auth insert audit"');
    expect(createdPoliciesFor("audit_logs")).toEqual([
      "active audit viewers read audit",
    ]);
  });

  it("limits Solomon reports and backup logs to their required commands", () => {
    expectPolicy(
      "solomon_reports",
      "active management read solomon reports",
      "select",
      management
    );
    expectPolicy(
      "solomon_reports",
      "active management insert solomon reports",
      "insert",
      management
    );
    expectPolicy(
      "backups_log",
      "active management read backup logs",
      "select",
      management
    );
    expect(createdPoliciesFor("solomon_reports")).toEqual([
      "active management read solomon reports",
      "active management insert solomon reports",
    ]);
    expect(createdPoliciesFor("backups_log")).toEqual([
      "active management read backup logs",
    ]);
  });

  it("contains partner financial access by role and command", () => {
    expectPolicy(
      "partner_payouts",
      "active backoffice read partner payouts",
      "select",
      backoffice
    );
    expectPolicy(
      "partner_payouts",
      "active management insert partner payouts",
      "insert",
      management
    );
    expectPolicy(
      "partner_payouts",
      "active management delete partner payouts",
      "delete",
      management
    );
    expect(createdPoliciesFor("partner_payouts")).toEqual([
      "active backoffice read partner payouts",
      "active management insert partner payouts",
      "active management delete partner payouts",
    ]);

    expectPolicy(
      "partner_investments",
      "active backoffice read partner investments",
      "select",
      backoffice
    );
    expectPolicy(
      "partner_investments",
      "active backoffice insert partner investments",
      "insert",
      backoffice
    );
    expectPolicy(
      "partner_investments",
      "active management delete partner investments",
      "delete",
      management
    );
    expect(createdPoliciesFor("partner_investments")).toEqual([
      "active backoffice read partner investments",
      "active backoffice insert partner investments",
      "active management delete partner investments",
    ]);
  });

  it("allows active users to read, insert, and update only their own Echo rows", () => {
    for (const command of ["select", "insert", "update"] as const) {
      const verb = command === "select" ? "read" : command;
      expectPolicy(
        "echo_conversations",
        `active users ${verb} own echo`,
        command,
        ownEcho
      );
    }
    expect(createdPoliciesFor("echo_conversations")).toEqual([
      "active users read own echo",
      "active users insert own echo",
      "active users update own echo",
    ]);
  });

  it("scopes job videos to job users and backoffice deletion", () => {
    for (const command of ["select", "insert", "update"] as const) {
      const verb = command === "select" ? "read" : command;
      expectPolicy(
        "job_videos",
        `active job users ${verb} job videos`,
        command,
        jobAccess
      );
    }
    const deletion = policyStatement(
      "job_videos",
      "active backoffice delete job videos"
    );
    expect(deletion.command).toBe("delete");
    expect(deletion.expression).toBe(
      `using (${backoffice} and ${jobAccess})`
    );
  });

  it("uses active-aware helpers rather than direct auth.role in replacements", () => {
    const replacementStatements = [...normalized.matchAll(/create policy "active [^;]+;/g)]
      .map((match) => match[0]);
    expect(replacementStatements).toHaveLength(29);
    for (const statement of replacementStatements) {
      expect(statement).not.toContain("auth.role()");
    }
  });

  it("ends with a fail-closed assertion that all legacy policies are gone", () => {
    const footer = normalized.match(/do \$\$ begin ([\s\S]+) end \$\$;$/)?.[1];
    expect(footer).toBeDefined();
    expect(footer).toContain("pg_policies");
    expect(footer).toMatch(/if exists \(.+\) then raise exception/);
    for (const [table, policy] of legacyPolicies) {
      expect(footer).toContain(`tablename = '${table}'`);
      expect(footer).toContain(`policyname = '${policy}'`);
    }
  });
});
