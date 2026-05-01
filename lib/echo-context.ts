import { createAdminClient } from "./supabase-server";

/**
 * One-shot context summary for Echo. Pre-aggregates the org's current
 * state into a compact text block that Echo reads as system context on
 * every question. Cheap because it's pre-aggregated — Echo never queries
 * raw tables itself, so token costs stay bounded regardless of org size.
 *
 * Caps:
 *   • Top 10 active jobs · agent feedback last 7d · MTD money · approvals
 *   • Total target: ~2K tokens worst-case.
 */
export async function buildEchoContext(operator: { name: string; role: string }): Promise<string> {
  const admin = createAdminClient();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: jobs },
    { data: invoicesMonth },
    { data: pendingApprovals },
    { data: outcomesWeek },
    { data: invocationsMonth },
    { data: latestBackup },
  ] = await Promise.all([
    admin
      .from("jobs")
      .select("id, job_number, status, type, site_city, customers(name, insurance_company), created_at, updated_at")
      .in("status", ["lead", "inspection", "mitigation", "drying", "reconstruction"])
      .order("updated_at", { ascending: false })
      .limit(15),
    admin
      .from("invoices")
      .select("status, sent_at, line_items:invoice_line_items(line_total), payments(amount)")
      .gte("created_at", monthStart),
    admin
      .from("pending_approvals")
      .select("entity_type, title, created_at")
      .eq("status", "pending"),
    admin
      .from("agent_outcomes")
      .select("agent, outcome")
      .gte("created_at", since7d),
    admin
      .from("agent_invocations")
      .select("model, cost_usd, agent")
      .gte("created_at", monthStart),
    admin
      .from("backups_log")
      .select("created_at")
      .eq("status", "ok")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ── Jobs summary
  const jobsByStatus = new Map<string, number>();
  for (const j of (jobs ?? []) as any[]) {
    jobsByStatus.set(j.status, (jobsByStatus.get(j.status) ?? 0) + 1);
  }
  const activeJobsLine = Array.from(jobsByStatus.entries())
    .map(([s, n]) => `${n} ${s}`)
    .join(" · ");

  const jobLines = (jobs ?? []).slice(0, 10).map((j: any) => {
    const cust = j.customers?.name ?? "—";
    const carrier = j.customers?.insurance_company ?? "self-pay";
    return `  • ${j.job_number} · ${cust} · ${j.status} · ${j.type ?? "?"} · ${carrier}${j.site_city ? ` · ${j.site_city}` : ""}`;
  });

  // ── Money — MTD
  let billed = 0;
  let collected = 0;
  let openBalance = 0;
  for (const inv of (invoicesMonth ?? []) as any[]) {
    if (inv.status === "void") continue;
    const total = (inv.line_items ?? []).reduce(
      (s: number, li: any) => s + Number(li.line_total ?? 0),
      0
    );
    const paid = (inv.payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount ?? 0),
      0
    );
    if (inv.sent_at) {
      billed += total;
      collected += paid;
      openBalance += Math.max(0, total - paid);
    }
  }

  // ── Approvals
  const approvalCount = pendingApprovals?.length ?? 0;
  const oldestApproval = (pendingApprovals ?? [])
    .map((a: any) => a.created_at)
    .sort()[0];
  const oldestApprovalDays = oldestApproval
    ? Math.floor((Date.now() - new Date(oldestApproval).getTime()) / 86_400_000)
    : null;

  // ── Agent outcomes (recursive learning signal)
  const outcomesByAgent = new Map<string, { ok: number; edited: number; rejected: number }>();
  for (const o of (outcomesWeek ?? []) as any[]) {
    const cur = outcomesByAgent.get(o.agent) ?? { ok: 0, edited: 0, rejected: 0 };
    if (o.outcome === "approved_unchanged") cur.ok += 1;
    else if (o.outcome === "approved_with_edits") cur.edited += 1;
    else if (o.outcome === "rejected" || o.outcome === "revised") cur.rejected += 1;
    outcomesByAgent.set(o.agent, cur);
  }
  const outcomeLines = Array.from(outcomesByAgent.entries())
    .map(([a, v]) => `  • ${a}: ${v.ok} approved · ${v.edited} edited · ${v.rejected} rejected`);

  // ── AI cost MTD
  const totalAiSpend = ((invocationsMonth ?? []) as any[])
    .reduce((s, i) => s + Number(i.cost_usd ?? 0), 0);
  const byAgentSpend = new Map<string, number>();
  for (const inv of (invocationsMonth ?? []) as any[]) {
    const agent = inv.agent ?? "unattributed";
    byAgentSpend.set(agent, (byAgentSpend.get(agent) ?? 0) + Number(inv.cost_usd ?? 0));
  }
  const topSpenders = Array.from(byAgentSpend.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a, c]) => `${a}: $${c.toFixed(2)}`)
    .join(" · ");

  // ── Backup health
  const backupAgeHours = (latestBackup as any)?.created_at
    ? Math.floor(
        (Date.now() - new Date((latestBackup as any).created_at).getTime()) / 3_600_000
      )
    : 999;

  return `You are Echo, the personal AI assistant for First Call Mitigation — an IICRC-certified water/fire/mold restoration company in Austin, Texas.

You answer ${operator.name}'s (the ${operator.role}) questions about the business using the live snapshot below. Your tone: direct, honest, no fluff. Numbers when you have them, "I don't know" when you don't. Don't make things up — if the answer isn't in the snapshot, say so and suggest where to look.

Current org snapshot (live, as of now):

ACTIVE JOBS (${jobs?.length ?? 0} total — ${activeJobsLine || "none"}):
${jobLines.join("\n") || "  (none)"}

MONEY MONTH-TO-DATE:
  • Billed:    $${billed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
  • Collected: $${collected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
  • Open AR:   $${openBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}

APPROVALS QUEUE: ${approvalCount} pending${oldestApprovalDays != null ? ` · oldest ${oldestApprovalDays}d` : ""}

AGENT FEEDBACK (last 7 days):
${outcomeLines.join("\n") || "  (no outcomes yet — agents haven't been corrected/approved much)"}

AI SPEND MTD: $${totalAiSpend.toFixed(2)} total${topSpenders ? ` · top: ${topSpenders}` : ""}

INFRA: backup last ran ${backupAgeHours}h ago${backupAgeHours > 168 ? " (STALE — flag this)" : ""}.

When ${operator.name} asks something the snapshot can't answer (deep historical analysis, multi-step reasoning across many records), tell them what page in the app would have it instead — e.g. "/reports/job-economics for full P&L by type, /reports/adjusters for carrier-by-carrier DSO, /turing for self-audit." Don't fabricate numbers.

Keep answers tight: 2–4 sentences for simple questions, max 8 sentences for complex. Use bullet points only when listing 3+ items. Never use markdown headers.`;
}
