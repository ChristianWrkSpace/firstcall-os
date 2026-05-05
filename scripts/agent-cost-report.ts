/**
 * Agent cost & efficiency report. Reads agent_invocations + downstream
 * artifact tables (estimates, legal_documents, solomon_reports) to answer
 * four questions in one place:
 *
 *   1. WORKING — is each agent actually firing? (call counts, error rate)
 *   2. EFFICIENT — are credits being well-spent? (cost per outcome)
 *   3. COST STRUCTURE — how is spend distributed across agents and tiers?
 *   4. COST OF COMPUTE — what does one call cost on average per agent?
 *
 * Read-only. Run with:  npx tsx scripts/agent-cost-report.ts [--days 30]
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const daysArgIdx = process.argv.indexOf("--days");
const WINDOW_DAYS = daysArgIdx >= 0 ? Number(process.argv[daysArgIdx + 1]) || 30 : 30;
const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function tierFor(model: string): "fast" | "balanced" | "smart" | "unknown" {
  const m = model.includes("/") ? model.split("/").slice(1).join("/") : model;
  if (m.includes("haiku") || m.includes("flash") || m.includes("mini")) return "fast";
  if (m.includes("sonnet") || m.includes("deepseek-v3") || m === "openai/gpt-4o") return "balanced";
  if (m.includes("opus") || m.includes("deepseek-r1")) return "smart";
  return "unknown";
}

type Provider = "anthropic" | "google" | "deepseek" | "openai" | "unknown";
function providerFor(model: string): Provider {
  if (!model) return "unknown";
  const lower = model.toLowerCase();
  if (lower.startsWith("anthropic/") || lower.startsWith("claude-")) return "anthropic";
  if (lower.startsWith("google/") || lower.startsWith("gemini")) return "google";
  if (lower.startsWith("deepseek/") || lower.startsWith("deepseek")) return "deepseek";
  if (lower.startsWith("openai/") || lower.startsWith("gpt-")) return "openai";
  return "unknown";
}

const fmt$ = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
const padR = (s: string, n: number) => " ".repeat(Math.max(0, n - s.length)) + s;

interface InvocationRow {
  agent: string | null;
  task: string | null;
  model: string;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

async function main() {
  console.log(`\n=== Agent Cost & Efficiency Report — last ${WINDOW_DAYS}d ===`);
  console.log(`Window: ${since.slice(0, 10)} → today\n`);

  const { data: invs, error: invErr } = await admin
    .from("agent_invocations")
    .select("agent, task, model, tokens_in, tokens_out, cost_usd, duration_ms, error, created_at")
    .gte("created_at", since);
  if (invErr) {
    console.error("agent_invocations read failed:", invErr.message);
    process.exit(1);
  }
  const rows = (invs ?? []) as InvocationRow[];
  if (rows.length === 0) {
    console.log("No agent_invocations in window. Either AI hasn't been used or table is empty.");
    return;
  }

  // ── 1. Per-agent totals ────────────────────────────────────────────────
  type AgentStat = {
    calls: number;
    cost: number;
    tokensIn: number;
    tokensOut: number;
    durationMs: number;
    errors: number;
    killSwitches: number;
    models: Set<string>;
  };
  const byAgent = new Map<string, AgentStat>();

  for (const r of rows) {
    const a = r.agent ?? "(untagged)";
    if (!byAgent.has(a)) {
      byAgent.set(a, {
        calls: 0,
        cost: 0,
        tokensIn: 0,
        tokensOut: 0,
        durationMs: 0,
        errors: 0,
        killSwitches: 0,
        models: new Set(),
      });
    }
    const s = byAgent.get(a)!;
    s.calls++;
    s.cost += Number(r.cost_usd ?? 0);
    s.tokensIn += Number(r.tokens_in ?? 0);
    s.tokensOut += Number(r.tokens_out ?? 0);
    s.durationMs += Number(r.duration_ms ?? 0);
    if (r.error) {
      if (String(r.error).includes("kill_switch")) s.killSwitches++;
      else s.errors++;
    }
    s.models.add(r.model);
  }

  const totalSpend = [...byAgent.values()].reduce((s, x) => s + x.cost, 0);

  console.log("─── PER-AGENT ROLLUP ─────────────────────────────────────");
  console.log(
    pad("agent", 14) +
      padR("calls", 7) +
      padR("cost", 10) +
      padR("avg/call", 11) +
      padR("share", 8) +
      padR("err%", 7) +
      pad("  model(s)", 18)
  );
  const sorted = [...byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost);
  for (const [agent, s] of sorted) {
    const errPct = s.calls > 0 ? (s.errors / s.calls) * 100 : 0;
    const sharePct = totalSpend > 0 ? (s.cost / totalSpend) * 100 : 0;
    const avgCost = s.calls > 0 ? s.cost / s.calls : 0;
    const models = [...s.models].map((m) => m.split("/").pop()).join(",");
    console.log(
      pad(agent, 14) +
        padR(s.calls.toString(), 7) +
        padR(fmt$(s.cost), 10) +
        padR(fmt$(avgCost), 11) +
        padR(`${sharePct.toFixed(1)}%`, 8) +
        padR(`${errPct.toFixed(1)}%`, 7) +
        "  " +
        models.slice(0, 28)
    );
  }
  console.log(pad("", 14) + padR("─────", 7) + padR("──────────", 10));
  console.log(
    pad("TOTAL", 14) +
      padR(rows.length.toString(), 7) +
      padR(fmt$(totalSpend), 10) +
      padR(fmt$(totalSpend / rows.length), 11)
  );

  // ── 2. Tier mix ────────────────────────────────────────────────────────
  const tierSpend = { fast: 0, balanced: 0, smart: 0, unknown: 0 };
  const tierCalls = { fast: 0, balanced: 0, smart: 0, unknown: 0 };
  for (const r of rows) {
    const t = tierFor(r.model);
    tierSpend[t] += Number(r.cost_usd ?? 0);
    tierCalls[t]++;
  }
  console.log("\n─── COMPUTE TIER MIX ─────────────────────────────────────");
  for (const t of ["smart", "balanced", "fast", "unknown"] as const) {
    const pct = totalSpend > 0 ? (tierSpend[t] / totalSpend) * 100 : 0;
    if (tierCalls[t] === 0) continue;
    console.log(
      `  ${pad(t.toUpperCase(), 10)} ${padR(tierCalls[t].toString() + " calls", 12)}  ${padR(
        fmt$(tierSpend[t]),
        10
      )}  (${pct.toFixed(1)}% of spend)`
    );
  }

  // ── 2b. Provider mix (Vercel AI Gateway) ──────────────────────────────
  const provSpend: Record<Provider, number> = {
    anthropic: 0, google: 0, deepseek: 0, openai: 0, unknown: 0,
  };
  const provCalls: Record<Provider, number> = {
    anthropic: 0, google: 0, deepseek: 0, openai: 0, unknown: 0,
  };
  for (const r of rows) {
    const p = providerFor(r.model);
    provSpend[p] += Number(r.cost_usd ?? 0);
    provCalls[p]++;
  }
  const providersInUse = (Object.keys(provCalls) as Provider[]).filter(
    (p) => provCalls[p] > 0
  );
  if (providersInUse.length > 0) {
    console.log("\n─── PROVIDER MIX (Vercel AI Gateway) ─────────────────────");
    for (const p of ["anthropic", "google", "deepseek", "openai", "unknown"] as const) {
      if (provCalls[p] === 0) continue;
      const pct = totalSpend > 0 ? (provSpend[p] / totalSpend) * 100 : 0;
      console.log(
        `  ${pad(p, 10)} ${padR(provCalls[p].toString() + " calls", 12)}  ${padR(
          fmt$(provSpend[p]),
          10
        )}  (${pct.toFixed(1)}% of spend)`
      );
    }
    if (providersInUse.length === 1) {
      console.log(
        `  (only ${providersInUse[0]} active — gateway BYOK keys for the others are provisioned but unused)`
      );
    }
  }

  // ── 3. Cost per business outcome ───────────────────────────────────────
  console.log("\n─── COST PER BUSINESS OUTCOME ────────────────────────────");

  // Estimates drafted in window → ledger.estimate_draft is the AI cost behind
  const estimateCost = byAgent.get("ledger")?.cost ?? 0;
  const { count: estimatesDrafted } = await admin
    .from("estimates")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (estimatesDrafted && estimatesDrafted > 0) {
    console.log(
      `  ${pad("estimates drafted", 22)} ${padR(estimatesDrafted.toString(), 5)} ` +
        `× ${fmt$(estimateCost / estimatesDrafted)} avg AI cost  (Ledger total ${fmt$(estimateCost)})`
    );
  }

  // Legal docs drafted → esquire.* tasks
  const esquireCost = byAgent.get("esquire")?.cost ?? 0;
  const { count: legalDocsDrafted } = await admin
    .from("legal_documents")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (legalDocsDrafted && legalDocsDrafted > 0) {
    console.log(
      `  ${pad("legal docs drafted", 22)} ${padR(legalDocsDrafted.toString(), 5)} ` +
        `× ${fmt$(esquireCost / legalDocsDrafted)} avg AI cost  (Esquire total ${fmt$(esquireCost)})`
    );
  }

  // Scope assessments → argus.scope_assessment
  const argusCost = byAgent.get("argus")?.cost ?? 0;
  const argusCalls = byAgent.get("argus")?.calls ?? 0;
  if (argusCalls > 0) {
    console.log(
      `  ${pad("scopes assessed", 22)} ${padR(argusCalls.toString(), 5)} ` +
        `× ${fmt$(argusCost / argusCalls)} avg AI cost  (Argus total ${fmt$(argusCost)})`
    );
  }

  // Echo conversations
  const echoCost = byAgent.get("echo")?.cost ?? 0;
  const echoCalls = byAgent.get("echo")?.calls ?? 0;
  if (echoCalls > 0) {
    console.log(
      `  ${pad("echo questions", 22)} ${padR(echoCalls.toString(), 5)} ` +
        `× ${fmt$(echoCost / echoCalls)} avg AI cost  (Echo total ${fmt$(echoCost)})`
    );
  }

  // Solomon reports
  const solomonCost = byAgent.get("solomon")?.cost ?? 0;
  const { count: solomonReports } = await admin
    .from("solomon_reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (solomonReports && solomonReports > 0) {
    console.log(
      `  ${pad("solomon reports", 22)} ${padR(solomonReports.toString(), 5)} ` +
        `× ${fmt$(solomonCost / solomonReports)} avg AI cost  (Solomon total ${fmt$(solomonCost)})`
    );
  }

  // ── 4. Daily trend (last 14d, capped at window) ────────────────────────
  const trendDays = Math.min(14, WINDOW_DAYS);
  console.log(`\n─── DAILY SPEND TREND (last ${trendDays}d) ───────────────────`);
  const byDay = new Map<string, { calls: number; cost: number }>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { calls: 0, cost: 0 });
    const d = byDay.get(day)!;
    d.calls++;
    d.cost += Number(r.cost_usd ?? 0);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-trendDays);
  const maxCost = Math.max(...days.map(([, d]) => d.cost), 0.01);
  for (const [day, d] of days) {
    const barLen = Math.round((d.cost / maxCost) * 30);
    const bar = "█".repeat(barLen) + "·".repeat(30 - barLen);
    console.log(
      `  ${day}  ${bar}  ${padR(fmt$(d.cost), 8)}  ${padR(d.calls.toString(), 4)} calls`
    );
  }

  // ── 5. Headline efficiency signals ─────────────────────────────────────
  console.log("\n─── HEADLINE SIGNALS ─────────────────────────────────────");
  const dailyAvg = totalSpend / WINDOW_DAYS;
  console.log(`  Avg daily spend:        ${fmt$(dailyAvg)}`);
  console.log(`  Projected 30d:          ${fmt$(dailyAvg * 30)}`);
  console.log(`  Avg cost per call:      ${fmt$(totalSpend / rows.length)}`);
  const totalErrors = [...byAgent.values()].reduce((s, x) => s + x.errors + x.killSwitches, 0);
  console.log(
    `  Failure rate:           ${((totalErrors / rows.length) * 100).toFixed(2)}% (${totalErrors}/${rows.length})`
  );
  const balancedShare = totalSpend > 0 ? (tierSpend.balanced / totalSpend) * 100 : 0;
  const smartShare = totalSpend > 0 ? (tierSpend.smart / totalSpend) * 100 : 0;
  console.log(
    `  Smart-tier share:       ${smartShare.toFixed(1)}%  (high → check if Sonnet/Haiku could substitute)`
  );
  console.log(`  Balanced-tier share:    ${balancedShare.toFixed(1)}%`);

  console.log("\n=== END ===\n");
}

main().catch((err) => {
  console.error("Cost report failed:", err);
  process.exit(1);
});
