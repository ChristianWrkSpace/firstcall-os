/**
 * Real-data coverage audit. Reads agent_invocations, agent_outcomes, and
 * audit_logs from the live Supabase project for the last 14 days and prints
 * a coverage matrix. No writes. Read-only.
 *
 * Run with: npx tsx scripts/coverage-audit.ts
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv(); // .env fallback

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WINDOW_DAYS = 14;
const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

const KNOWN_AGENTS = [
  "argus",
  "ledger",
  "esquire",
  "solomon",
  "hunter",
  "extract",
  "abacus",
  "echo",
];

const KNOWN_OUTCOMES = [
  "approved_unchanged",
  "approved_with_edits",
  "rejected",
  "revised",
  "corrected",
];

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

async function main() {
  console.log(`\n=== FirstCall OS — Coverage Audit (last ${WINDOW_DAYS} days) ===`);
  console.log(`Window: ${since.slice(0, 10)} → today\n`);

  // 1. agent_invocations — what fired and at what cost
  const { data: invs, error: invErr } = await admin
    .from("agent_invocations")
    .select("agent, task, model, tokens_in, tokens_out, cost_usd, duration_ms, error, created_at")
    .gte("created_at", since);

  if (invErr) {
    console.error("agent_invocations query failed:", invErr.message);
    process.exit(1);
  }

  console.log("─── INVOCATIONS ───");
  console.log(`Total calls: ${invs?.length ?? 0}`);
  if (invs && invs.length > 0) {
    const byAgent = new Map<string, { count: number; cost: number; errors: number }>();
    let totalCost = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let errorCount = 0;
    let timeoutCount = 0;
    let killSwitchCount = 0;

    for (const row of invs as any[]) {
      const a = row.agent ?? "(untagged)";
      const cur = byAgent.get(a) ?? { count: 0, cost: 0, errors: 0 };
      cur.count++;
      cur.cost += Number(row.cost_usd ?? 0);
      if (row.error) cur.errors++;
      byAgent.set(a, cur);

      totalCost += Number(row.cost_usd ?? 0);
      totalTokensIn += Number(row.tokens_in ?? 0);
      totalTokensOut += Number(row.tokens_out ?? 0);
      if (row.error) errorCount++;
      if (row.error?.toLowerCase().includes("timeout")) timeoutCount++;
      if (row.error?.includes("kill_switch")) killSwitchCount++;
    }

    console.log(`Total cost: ${fmtUsd(totalCost)}`);
    console.log(`Total tokens: ${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out`);
    console.log(`Errors: ${errorCount} (timeouts: ${timeoutCount}, kill-switch: ${killSwitchCount})`);
    console.log(`Avg cost/call: ${fmtUsd(totalCost / invs.length)}`);
    console.log(`\n  By agent:`);
    const sorted = [...byAgent.entries()].sort((a, b) => b[1].count - a[1].count);
    console.log(`    ${pad("agent", 14)} ${pad("calls", 8)} ${pad("cost", 10)} errors`);
    for (const [agent, s] of sorted) {
      console.log(
        `    ${pad(agent, 14)} ${pad(String(s.count), 8)} ${pad(fmtUsd(s.cost), 10)} ${s.errors}`
      );
    }

    // Cold agents — declared but never fired
    const cold = KNOWN_AGENTS.filter((a) => !byAgent.has(a));
    if (cold.length > 0) {
      console.log(`\n  ⚠ Cold agents (no invocations in window): ${cold.join(", ")}`);
    }
  }

  // 2. agent_outcomes — Law 5 closed feedback loop coverage
  const { data: outcomes, error: outErr } = await admin
    .from("agent_outcomes")
    .select("agent, task, outcome, created_at")
    .gte("created_at", since);

  if (outErr) {
    console.error("\nagent_outcomes query failed:", outErr.message);
  } else {
    console.log("\n─── OUTCOMES (Law 5 — closed feedback loop) ───");
    console.log(`Total outcomes: ${outcomes?.length ?? 0}`);
    if (outcomes && outcomes.length > 0) {
      const byAgent = new Map<string, Map<string, number>>();
      for (const row of outcomes as any[]) {
        const a = row.agent;
        const o = row.outcome;
        if (!byAgent.has(a)) byAgent.set(a, new Map());
        byAgent.get(a)!.set(o, (byAgent.get(a)!.get(o) ?? 0) + 1);
      }
      console.log(`\n  By agent x outcome:`);
      console.log(
        `    ${pad("agent", 14)} ${KNOWN_OUTCOMES.map((o) => pad(o.slice(0, 14), 16)).join("")}`
      );
      for (const [agent, outcomeMap] of byAgent) {
        const cells = KNOWN_OUTCOMES.map((o) =>
          pad(String(outcomeMap.get(o) ?? 0), 16)
        ).join("");
        console.log(`    ${pad(agent, 14)} ${cells}`);
      }
    }

    // Coverage gap: invocations that produced no outcome
    if (invs && outcomes) {
      const invsByAgent = new Map<string, number>();
      for (const row of invs as any[]) {
        const a = row.agent ?? null;
        if (a) invsByAgent.set(a, (invsByAgent.get(a) ?? 0) + 1);
      }
      const outcomesByAgent = new Map<string, number>();
      for (const row of outcomes as any[]) {
        const a = row.agent;
        outcomesByAgent.set(a, (outcomesByAgent.get(a) ?? 0) + 1);
      }
      console.log(`\n  Coverage ratio (outcomes/invocations) per agent:`);
      const allAgents = new Set([...invsByAgent.keys(), ...outcomesByAgent.keys()]);
      for (const agent of [...allAgents].sort()) {
        const i = invsByAgent.get(agent) ?? 0;
        const o = outcomesByAgent.get(agent) ?? 0;
        const ratio = i === 0 ? "—" : `${((o / i) * 100).toFixed(0)}%`;
        const flag = i > 3 && o === 0 ? "  ⚠ blind" : "";
        console.log(`    ${pad(agent, 14)} ${pad(String(o), 5)}/${pad(String(i), 5)} = ${ratio}${flag}`);
      }
    }
  }

  // 3. audit_logs — operational signal density
  const { data: audits, error: auditErr } = await admin
    .from("audit_logs")
    .select("action, created_at")
    .gte("created_at", since);

  if (auditErr) {
    console.error("\naudit_logs query failed:", auditErr.message);
  } else {
    console.log("\n─── AUDIT LOG ACTIONS ───");
    console.log(`Total events: ${audits?.length ?? 0}`);
    if (audits && audits.length > 0) {
      const byAction = new Map<string, number>();
      for (const row of audits as any[]) {
        byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1);
      }
      const sorted = [...byAction.entries()].sort((a, b) => b[1] - a[1]);
      console.log(`\n  Top 15 actions:`);
      for (const [action, count] of sorted.slice(0, 15)) {
        console.log(`    ${pad(action, 36)} ${count}`);
      }
    }
  }

  // 4. Pending approvals snapshot — Law 4 blast radius
  const { data: pending } = await admin
    .from("pending_approvals")
    .select("kind, status, created_at")
    .gte("created_at", since);

  console.log("\n─── PENDING APPROVALS (window) ───");
  if (pending && pending.length > 0) {
    const byStatus = new Map<string, number>();
    const byKind = new Map<string, number>();
    let stale48h = 0;
    const cutoff48 = Date.now() - 48 * 3_600_000;
    for (const row of pending as any[]) {
      byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
      byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
      if (row.status === "pending" && new Date(row.created_at).getTime() < cutoff48) {
        stale48h++;
      }
    }
    console.log(`Total: ${pending.length}`);
    console.log(`  By status: ${[...byStatus].map(([k, v]) => `${k}=${v}`).join(", ")}`);
    console.log(`  By kind:   ${[...byKind].map(([k, v]) => `${k}=${v}`).join(", ")}`);
    console.log(`  Stale (>48h, pending): ${stale48h}${stale48h > 0 ? "  ⚠ digest will fire" : ""}`);
  } else {
    console.log("None.");
  }

  // 5. Sanity check: today's spend vs cap (would the kill-switch fire?)
  const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  const { data: today } = await admin
    .from("agent_invocations")
    .select("cost_usd")
    .gte("created_at", todayStart);
  const todayCost = (today ?? []).reduce(
    (s: number, r: any) => s + Number(r.cost_usd ?? 0),
    0
  );
  const cap = Number(process.env.AI_DAILY_SPEND_CAP_USD ?? 50);
  console.log("\n─── KILL-SWITCH STATE ───");
  console.log(`Today's spend: ${fmtUsd(todayCost)} / ${fmtUsd(cap)} cap`);
  if (todayCost >= cap) {
    console.log(`  ⛔ Kill-switch ACTIVE — next call would refuse.`);
  } else {
    const headroom = cap - todayCost;
    console.log(`  ✓ Headroom: ${fmtUsd(headroom)} (${((todayCost / cap) * 100).toFixed(1)}% used)`);
  }

  console.log("\n=== END ===\n");
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
