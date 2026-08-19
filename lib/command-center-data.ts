// Real-data loader for the Command Center shell. Returns the same
// ShellData shape that the MOCK provided — drop-in.

import { createServerSupabaseClient } from "./supabase-server";
import { tierFor, providerFor } from "./ai-cost";
import { getDataCutoff } from "./data-cutoff";

// Mirror of CommandCenterShell.ShellData (kept loose to stay decoupled)
export interface ShellData {
  operator: { name: string; role: string };
  agentWorkflows: AgentWorkflow[];
  handoffs: Handoff[];
  jobPulse: JobPulseEntry[];
  todayMetrics: {
    callsTaken: number;
    jobsCreated: number;
    revenueTouched: number;
    agentActions: number;
  };
  systemPulse: {
    triggersLast24h: number;
    pendingApprovals: number;
    failedSends: number;
    backupAgeHours: number;
  };
  compute: ComputeStats;
}

export interface AgentWorkflow {
  id: string;
  agent: string;
  icon: string;
  intent: string;
  target: string;
  progress: number;
  etaMin: number;
  state: "processing" | "complete" | "blocked";
}

export interface Handoff {
  id: string;
  agent: string;
  title: string;
  detail: string;
  severity: "high" | "med" | "low";
  ageMinutes: number;
  href: string;
}

export interface JobPulseEntry {
  id: string;
  number: string;
  customer: string;
  status: string;
  site: string;
  lastTouchMin: number;
}

export interface ComputeStats {
  mtdSpendUsd: number;
  todaySpendUsd: number;
  invocationsToday: number;
  byTier: { fast: number; balanced: number; smart: number; unknown: number };
  // Provider split — every gateway-routed call is attributed to its provider
  // (anthropic / google / deepseek / openai). Reads as zero when only direct
  // Anthropic is in use; non-zero when the gateway routes elsewhere.
  byProvider: {
    anthropic: { cost: number; calls: number };
    google: { cost: number; calls: number };
    deepseek: { cost: number; calls: number };
    openai: { cost: number; calls: number };
    unknown: { cost: number; calls: number };
  };
  topAgentByCost: { agent: string; cost: number } | null;
  lastInvocations: Array<{
    model: string;
    cost: number;
    minutesAgo: number;
  }>;
}

const AGENT_META: Record<string, { icon: string; name: string }> = {
  argus:    { icon: "👁",  name: "Argus" },
  ledger:   { icon: "📒",  name: "Ledger" },
  esquire:  { icon: "⚖",  name: "Esquire" },
  solomon:  { icon: "🧠",  name: "Solomon" },
  hunter:   { icon: "🎯",  name: "Hunter" },
  athena:   { icon: "📞",  name: "Athena" },
  abacus:   { icon: "💵",  name: "Abacus" },
  hydra:    { icon: "💧",  name: "Hydra" },
  default:  { icon: "🤖",  name: "Agent" },
};

const PENDING_TYPE_META: Record<string, { agent: string; verb: string; sev: "high" | "med" | "low" }> = {
  estimate:        { agent: "ledger",  verb: "Estimate ready for review",        sev: "med" },
  legal_document:  { agent: "esquire", verb: "Legal doc awaiting approval",      sev: "high" },
  invoice:         { agent: "abacus",  verb: "Invoice ready to send",            sev: "med" },
  scope:           { agent: "argus",   verb: "Scope ready for verification",     sev: "med" },
  default:         { agent: "system",  verb: "Action required",                  sev: "low" },
};

export async function loadCommandCenterData(operator: {
  name: string;
  role: string;
}): Promise<ShellData> {
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();
  // Most queries below already restrict to "since today/last hour" so the
  // cutoff doesn't change them. The two that need it are the active-jobs
  // list and the pending approvals queue — both can surface pre-launch
  // test rows otherwise.
  const sinceForCutoff = cutoff ?? "1970-01-01T00:00:00Z";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const since1h = new Date(Date.now() - 3_600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: pendingApprovals },
    { data: agentOutcomesRecent },
    { data: jobsActive },
    { data: jobsToday },
    { data: callsToday },
    { data: invoicesToday },
    { data: triggers24h },
    { data: failedSends },
    { data: latestBackup },
    { data: invocationsMonth },
    { data: invocationsLast5 },
    { data: invocationsToday },
  ] = await Promise.all([
    supabase
      .from("pending_approvals")
      .select("id, kind, job_id, entity_type, entity_id, title, detail, link, created_at, status")
      .eq("status", "pending")
      .gte("created_at", sinceForCutoff)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_outcomes")
      .select("agent, task, outcome, created_at")
      .gte("created_at", since1h)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("jobs")
      .select("id, job_number, status, site_city, updated_at, created_at, customers(name)")
      .eq("is_test", false)
      .in("status", ["lead", "inspection", "mitigation", "drying", "reconstruction"])
      .gte("created_at", sinceForCutoff)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("jobs")
      .select("id")
      .eq("is_test", false)
      .gte("created_at", todayIso),
    supabase
      .from("calls")
      .select("id, jobs!inner(is_test)")
      .eq("jobs.is_test", false)
      .gte("created_at", todayIso),
    supabase
      .from("invoices")
      .select("status, sent_at, jobs!inner(is_test), line_items:invoice_line_items(line_total)")
      .eq("jobs.is_test", false)
      .gte("created_at", todayIso),
    supabase
      .from("audit_logs")
      .select("id, action")
      .is("user_id", null)
      .gte("created_at", since24h),
    supabase
      .from("legal_documents")
      .select("id, last_send_attempt")
      .not("last_send_attempt", "is", null)
      .gte("created_at", since7d),
    supabase
      .from("backups_log")
      .select("created_at")
      .eq("status", "ok")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("agent_invocations")
      .select("model, agent, cost_usd")
      .gte("created_at", monthStart),
    supabase
      .from("agent_invocations")
      .select("model, cost_usd, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("agent_invocations")
      .select("id")
      .gte("created_at", todayIso),
  ]);

  // ── Workflows: derive from recent agent_outcomes (last hour) as "completed"
  // workflows + currently-pending approvals as "processing/awaiting" workflows.
  const workflows: AgentWorkflow[] = [];

  for (const a of (pendingApprovals ?? []).slice(0, 4) as any[]) {
    const meta = PENDING_TYPE_META[a.entity_type] ?? PENDING_TYPE_META.default;
    const agentMeta = AGENT_META[meta.agent] ?? AGENT_META.default;
    workflows.push({
      id: `pa-${a.id}`,
      agent: agentMeta.name,
      icon: agentMeta.icon,
      intent: a.title ?? meta.verb,
      target: a.detail ?? "—",
      progress: 1,            // draft is done; awaiting human
      etaMin: 0,
      state: "blocked",       // blocked on human action
    });
  }

  for (const o of (agentOutcomesRecent ?? []).slice(0, 4) as any[]) {
    const agentMeta = AGENT_META[o.agent] ?? AGENT_META.default;
    workflows.push({
      id: `out-${o.created_at}-${o.agent}`,
      agent: agentMeta.name,
      icon: agentMeta.icon,
      intent: humanize(o.task),
      target: outcomeBadge(o.outcome),
      progress: 1,
      etaMin: 0,
      state: "complete",
    });
  }

  // ── Handoffs: pending approvals with severity by type
  const handoffs: Handoff[] = (pendingApprovals ?? []).slice(0, 5).map((a: any) => {
    const meta = PENDING_TYPE_META[a.entity_type] ?? PENDING_TYPE_META.default;
    const agentMeta = AGENT_META[meta.agent] ?? AGENT_META.default;
    const ageMs = Date.now() - new Date(a.created_at).getTime();
    return {
      id: a.id,
      agent: agentMeta.name,
      title: a.title ?? meta.verb,
      detail: a.detail ?? "Awaiting your review.",
      severity: meta.sev,
      ageMinutes: Math.max(0, Math.floor(ageMs / 60_000)),
      href: a.link ?? (a.job_id ? `/jobs/${a.job_id}` : `/approvals#approval-${a.id}`),
    };
  });

  // ── Job Pulse
  const jobPulse: JobPulseEntry[] = (jobsActive ?? []).map((j: any) => {
    const lastTouchMs = Date.now() - new Date(j.updated_at ?? j.created_at).getTime();
    return {
      id: j.id,
      number: j.job_number ?? j.id.slice(0, 8),
      customer: j.customers?.name ?? "—",
      status: j.status ?? "lead",
      site: j.site_city ?? "—",
      lastTouchMin: Math.max(0, Math.floor(lastTouchMs / 60_000)),
    };
  });

  // ── Today metrics
  const revenueTouched = ((invoicesToday ?? []) as any[])
    .filter((i) => i.sent_at)
    .reduce((s, i) => {
      const t = (i.line_items ?? []).reduce(
        (ss: number, li: any) => ss + Number(li.line_total ?? 0),
        0
      );
      return s + t;
    }, 0);

  const todayMetrics = {
    callsTaken: callsToday?.length ?? 0,
    jobsCreated: jobsToday?.length ?? 0,
    revenueTouched: Math.round(revenueTouched),
    agentActions: triggers24h?.length ?? 0,
  };

  // ── System Pulse
  const failedSendsCount = (failedSends ?? []).filter(
    (d: any) =>
      d.last_send_attempt?.status === "failed" ||
      d.last_send_attempt?.status === "skipped"
  ).length;
  const backupAgeHours = (latestBackup as any)?.created_at
    ? Math.floor(
        (Date.now() - new Date((latestBackup as any).created_at).getTime()) /
          3_600_000
      )
    : 999;

  const systemPulse = {
    triggersLast24h: triggers24h?.length ?? 0,
    pendingApprovals: pendingApprovals?.length ?? 0,
    failedSends: failedSendsCount,
    backupAgeHours,
  };

  // ── Compute / cost
  const mtd = invocationsMonth ?? [];
  const today_ = invocationsToday ?? [];
  const last5 = invocationsLast5 ?? [];

  const byTier = { fast: 0, balanced: 0, smart: 0, unknown: 0 };
  const byProvider = {
    anthropic: { cost: 0, calls: 0 },
    google:    { cost: 0, calls: 0 },
    deepseek:  { cost: 0, calls: 0 },
    openai:    { cost: 0, calls: 0 },
    unknown:   { cost: 0, calls: 0 },
  };
  const byAgent = new Map<string, number>();

  for (const inv of mtd as any[]) {
    const cost = Number(inv.cost_usd ?? 0);
    const tier = tierFor(inv.model);
    byTier[tier] += cost;
    const provider = providerFor(inv.model);
    byProvider[provider].cost += cost;
    byProvider[provider].calls++;
    if (inv.agent) {
      byAgent.set(inv.agent, (byAgent.get(inv.agent) ?? 0) + cost);
    }
  }
  const mtdSpendUsd = byTier.fast + byTier.balanced + byTier.smart + byTier.unknown;

  let topAgentByCost: ComputeStats["topAgentByCost"] = null;
  for (const [agent, cost] of byAgent) {
    if (!topAgentByCost || cost > topAgentByCost.cost) {
      topAgentByCost = { agent, cost };
    }
  }

  const todaySpendUsd = (today_ as any[]).reduce(
    (s, i) => s + Number(i.cost_usd ?? 0),
    0
  );

  const compute: ComputeStats = {
    mtdSpendUsd: Math.round(mtdSpendUsd * 100) / 100,
    todaySpendUsd: Math.round(todaySpendUsd * 100) / 100,
    invocationsToday: today_.length,
    byTier: {
      fast: Math.round(byTier.fast * 100) / 100,
      balanced: Math.round(byTier.balanced * 100) / 100,
      smart: Math.round(byTier.smart * 100) / 100,
      unknown: Math.round(byTier.unknown * 100) / 100,
    },
    byProvider: {
      anthropic: { cost: Math.round(byProvider.anthropic.cost * 100) / 100, calls: byProvider.anthropic.calls },
      google:    { cost: Math.round(byProvider.google.cost    * 100) / 100, calls: byProvider.google.calls    },
      deepseek:  { cost: Math.round(byProvider.deepseek.cost  * 100) / 100, calls: byProvider.deepseek.calls  },
      openai:    { cost: Math.round(byProvider.openai.cost    * 100) / 100, calls: byProvider.openai.calls    },
      unknown:   { cost: Math.round(byProvider.unknown.cost   * 100) / 100, calls: byProvider.unknown.calls   },
    },
    topAgentByCost: topAgentByCost
      ? {
          agent: AGENT_META[topAgentByCost.agent]?.name ?? topAgentByCost.agent,
          cost: Math.round(topAgentByCost.cost * 100) / 100,
        }
      : null,
    lastInvocations: (last5 as any[]).map((i) => ({
      model: i.model,
      cost: Number(i.cost_usd ?? 0),
      minutesAgo: Math.max(
        0,
        Math.floor((Date.now() - new Date(i.created_at).getTime()) / 60_000)
      ),
    })),
  };

  return {
    operator,
    agentWorkflows: workflows.slice(0, 6),
    handoffs,
    jobPulse,
    todayMetrics,
    systemPulse,
    compute,
  };
}

function humanize(task: string | null): string {
  if (!task) return "—";
  return task
    .replace(/_/g, " ")
    .replace(/\b(\w)/g, (m) => m.toUpperCase())
    .replace(/\bDraft\b/, "draft");
}

function outcomeBadge(outcome: string): string {
  switch (outcome) {
    case "approved_unchanged":  return "Approved as-is";
    case "approved_with_edits": return "Approved with edits";
    case "rejected":            return "Rejected";
    case "revised":             return "Revised";
    case "corrected":           return "Corrected on-site";
    default:                    return outcome;
  }
}
