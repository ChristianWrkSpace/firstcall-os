import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { requireRoles } from "@/components/RoleGate";
import { PageShell, EmptyState } from "@/components/ui/Glass";

// Live orchestration feed. Shows what every agent + system action has done
// recently across all jobs. Color-coded by agent so the office can scan
// what's happening at a glance.

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
}

const ACTION_META: Record<
  string,
  { agent: string; emoji: string; color: string; label: string }
> = {
  // Esquire
  "legal_doc.generated": { agent: "Esquire", emoji: "⚖️", color: "blue", label: "drafted a legal document" },
  "legal_doc.approved": { agent: "Esquire", emoji: "⚖️", color: "blue", label: "approved" },
  "legal_doc.sent": { agent: "Esquire", emoji: "⚖️", color: "blue", label: "marked sent" },
  "legal_doc.signed": { agent: "Esquire", emoji: "⚖️", color: "blue", label: "marked signed" },
  "legal_doc.signed_online": { agent: "Esquire", emoji: "✍️", color: "green", label: "customer e-signed online" },
  "legal_doc.auto_sent": { agent: "Esquire", emoji: "📨", color: "green", label: "auto-sent to customer" },
  "legal_doc.send_sent": { agent: "Esquire", emoji: "📨", color: "green", label: "email delivered" },
  "legal_doc.send_skipped": { agent: "Esquire", emoji: "⏭", color: "amber", label: "send skipped" },
  "legal_doc.send_failed": { agent: "Esquire", emoji: "❌", color: "red", label: "send failed" },
  "legal_doc.manual_send_triggered": { agent: "Esquire", emoji: "📨", color: "blue", label: "manual send triggered" },
  "legal_doc.deleted": { agent: "Esquire", emoji: "🗑", color: "zinc", label: "deleted" },
  // Approvals (orchestration)
  "approval.dismissed": { agent: "Inbox", emoji: "🔔", color: "zinc", label: "approval dismissed" },
  "approval.suggestion_applied": { agent: "Inbox", emoji: "🔔", color: "blue", label: "suggestion applied" },
  // Jobs
  "job.auto_paused": { agent: "Job", emoji: "⏸", color: "amber", label: "auto-actions paused" },
  "job.auto_resumed": { agent: "Job", emoji: "▶️", color: "green", label: "auto-actions resumed" },
  // Invoices
  "payment.recorded_via_stripe": { agent: "Stripe", emoji: "💳", color: "green", label: "payment recorded via Stripe" },
  "invoice.sent": { agent: "Abacus", emoji: "💵", color: "blue", label: "invoice sent" },
  "invoice.voided": { agent: "Abacus", emoji: "🗑", color: "zinc", label: "invoice voided" },
  "payment.recorded": { agent: "Abacus", emoji: "💵", color: "green", label: "payment recorded" },
  // Solomon
  "solomon.report_generated": { agent: "Solomon", emoji: "🧠", color: "purple", label: "FP&A report generated" },
  // Backups
  "backup.manual_triggered": { agent: "Backups", emoji: "💾", color: "blue", label: "manual backup" },
  // Customers
  "customer.pii_redacted": { agent: "Privacy", emoji: "🔒", color: "amber", label: "PII redacted" },
  "customer.auto_notify_set": { agent: "Customer", emoji: "✉️", color: "zinc", label: "auto-notify toggle changed" },
  // Partners
  "partner.payout_logged": { agent: "Partners", emoji: "🤝", color: "green", label: "cash payout logged" },
  "partner.investment_logged": { agent: "Partners", emoji: "🤝", color: "blue", label: "investment logged" },
  // Users
  "user.role_changed": { agent: "System", emoji: "👤", color: "amber", label: "role changed" },
  "user.activated": { agent: "System", emoji: "👤", color: "green", label: "user activated" },
  "user.deactivated": { agent: "System", emoji: "👤", color: "amber", label: "user deactivated" },
  // Secrets
  "secret.rotated": { agent: "Security", emoji: "🔑", color: "blue", label: "secret rotated" },
};

// Agent hue, softened to glass weights for the dark stage.
const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-[#6B8AD9]/[0.08] border-[#6B8AD9]/25 text-[#A6B8E7]",
  green: "bg-emerald-400/[0.07] border-emerald-400/25 text-emerald-200",
  amber: "bg-amber-400/[0.07] border-amber-400/25 text-amber-200",
  red: "bg-red-400/[0.07] border-red-400/25 text-red-200",
  purple: "bg-violet-400/[0.07] border-violet-400/25 text-violet-200",
  zinc: "bg-white/[0.025] border-white/[0.08] text-white/75",
};

const AGENT_FILTER_OPTIONS = [
  { value: "", label: "All agents" },
  { value: "Esquire", label: "Esquire — Legal" },
  { value: "Solomon", label: "Solomon — FP&A" },
  { value: "Abacus", label: "Abacus — AR / Invoices" },
  { value: "Stripe", label: "Stripe — Payments" },
  { value: "Inbox", label: "Inbox — Approvals" },
  { value: "Backups", label: "Backups" },
  { value: "Partners", label: "Partners" },
  { value: "System", label: "System" },
  { value: "Security", label: "Security" },
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; limit?: string }>;
}) {
  await requireRoles(["owner", "manager", "office"]);
  const sp = await searchParams;
  const agentFilter = sp.agent ?? "";
  const limit = Math.min(Math.max(parseInt(sp.limit ?? "100"), 25), 500);

  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();
  let rowsQuery = supabase
    .from("audit_logs")
    .select("id, created_at, user_id, user_name, action, entity_type, entity_id, details")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cutoff) rowsQuery = rowsQuery.gte("created_at", cutoff);
  const { data: rows } = await rowsQuery;

  const all = (rows ?? []) as AuditRow[];
  const items = agentFilter ? all.filter((r) => ACTION_META[r.action]?.agent === agentFilter) : all;

  const counts: Record<string, number> = {};
  for (const r of all) {
    const m = ACTION_META[r.action];
    if (!m) continue;
    counts[m.agent] = (counts[m.agent] ?? 0) + 1;
  }

  return (
    <PageShell
      eyebrow="Agent decisions"
      title="Agent Activity"
      subtitle="Real-time feed of every system action across all jobs — what the agents drafted, what got auto-sent, what's blocked. Filter by agent to focus."
      width="wide"
    >
      {/* Agent counts strip */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {AGENT_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
          <Link
            key={o.value}
            href={`/activity?agent=${o.value}`}
            className={`px-3 py-2 rounded-xl border text-xs transition-all ${
              agentFilter === o.value
                ? "border-[#5FBDB0]/30 bg-[#5FBDB0]/[0.06] text-white ring-1 ring-[#5FBDB0]/15"
                : "border-white/[0.06] bg-white/[0.02] text-white/75 hover:border-white/15 hover:bg-white/[0.04]"
            }`}
          >
            <p className="font-semibold">{o.value}</p>
            <p className="text-white/40 text-[10px] mt-0.5">{counts[o.value] ?? 0} actions</p>
          </Link>
        ))}
      </section>

      {agentFilter && (
        <Link
          href="/activity"
          className="inline-block mb-3 text-[#A8DCD3] hover:text-white text-xs transition-colors"
        >
          ← All agents
        </Link>
      )}

      {/* Feed */}
      {items.length === 0 ? (
        <EmptyState
          icon="🎛"
          title={
            agentFilter
              ? `No recent activity from ${agentFilter}.`
              : "No system activity yet."
          }
        >
          {!agentFilter && "Once you create a job or approve a draft, agents start working."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((r, i) => {
            const meta =
              ACTION_META[r.action] ?? { agent: "Other", emoji: "•", color: "zinc", label: r.action };
            const colorClass = COLOR_CLASSES[meta.color] ?? COLOR_CLASSES.zinc;
            const isSystem = !r.user_id;
            const jobLink =
              r.entity_type === "legal_document" && r.details?.job_id
                ? `/jobs/${r.details.job_id}/legal/${r.entity_id}`
                : r.details?.job_id
                  ? `/jobs/${r.details.job_id}`
                  : null;

            return (
              <article
                key={r.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border animate-rise-in ${colorClass}`}
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <div className="text-xl shrink-0 leading-none mt-0.5">{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90">
                    <span className="font-semibold">{meta.agent}</span>
                    <span className="text-white/40"> · </span>
                    <span>{meta.label}</span>
                    {r.details?.doc_type && (
                      <>
                        <span className="text-white/40"> · </span>
                        <span className="text-white/70 text-xs font-mono">{r.details.doc_type}</span>
                      </>
                    )}
                  </p>
                  <div className="mt-1 text-[11px] text-white/45 flex flex-wrap gap-2">
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                    <span>·</span>
                    <span>{isSystem ? <em className="text-white/35">system</em> : r.user_name ?? "unknown user"}</span>
                    {r.details?.reason && (
                      <>
                        <span>·</span>
                        <span className="text-white/70">{r.details.reason}</span>
                      </>
                    )}
                    {r.details?.recipient && (
                      <>
                        <span>·</span>
                        <span className="font-mono">→ {r.details.recipient}</span>
                      </>
                    )}
                  </div>
                </div>
                {jobLink && (
                  <Link
                    href={jobLink}
                    className="text-xs text-white/60 hover:text-white shrink-0 self-center transition-colors"
                  >
                    Open →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
