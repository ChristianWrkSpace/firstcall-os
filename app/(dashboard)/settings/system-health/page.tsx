import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { requireRoles } from "@/components/RoleGate";

const fmtAgo = (iso: string | null): string => {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

const NDAYS_AGO_ISO = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export default async function SystemHealthPage() {
  await requireRoles(["owner", "manager"]);
  const supabase = await createServerSupabaseClient();

  const last24h = NDAYS_AGO_ISO(1);
  const last7d = NDAYS_AGO_ISO(7);

  const [
    { data: triggers24h },
    { data: failedSends },
    { data: outcomes7d },
    { data: lastDryingAudit },
    { data: pendingApprovals },
    { data: recentBackup },
  ] = await Promise.all([
    // Auto-triggers fired in the last 24h (look at audit_logs for system actions)
    supabase
      .from("audit_logs")
      .select("action, created_at")
      .is("user_id", null)
      .gte("created_at", last24h),
    // Failed legal-doc sends in the last 7 days
    supabase
      .from("legal_documents")
      .select("id, last_send_attempt")
      .not("last_send_attempt", "is", null)
      .gte("created_at", last7d),
    // Agent outcomes accumulated in the last 7 days (recursive learning fuel)
    supabase
      .from("agent_outcomes")
      .select("agent, outcome, created_at")
      .gte("created_at", last7d),
    // Last drying-cert audit run
    supabase
      .from("audit_logs")
      .select("created_at, details")
      .eq("action", "drying_cert_audit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Pending approvals — should be a small number; if huge, the office is behind
    supabase
      .from("pending_approvals")
      .select("id, created_at")
      .eq("status", "pending"),
    // Last successful backup
    supabase
      .from("backups_log")
      .select("created_at, status")
      .eq("status", "ok")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // ─── Derived signals ─────────────────────────────────────────────────
  const triggerCount24h = triggers24h?.length ?? 0;

  const failedSendCount = (failedSends ?? []).filter((d: any) => {
    const status = d.last_send_attempt?.status;
    return status === "failed" || status === "skipped";
  }).length;

  const outcomesByAgent = new Map<string, number>();
  for (const o of outcomes7d ?? []) {
    outcomesByAgent.set(
      o.agent,
      (outcomesByAgent.get(o.agent) ?? 0) + 1
    );
  }
  const totalOutcomes7d = outcomes7d?.length ?? 0;

  const dryingAuditAgo = (lastDryingAudit as any)?.created_at ?? null;
  const dryingAuditStale = dryingAuditAgo
    ? Date.now() - new Date(dryingAuditAgo).getTime() > 8 * 24 * 60 * 60 * 1000
    : true;

  const pendingApprovalCount = pendingApprovals?.length ?? 0;
  const oldestApproval = (pendingApprovals ?? [])
    .map((a: any) => a.created_at)
    .sort()[0];
  const oldestApprovalDays = oldestApproval
    ? Math.floor(
        (Date.now() - new Date(oldestApproval).getTime()) / 86_400_000
      )
    : null;

  const lastBackupAt = (recentBackup as any)?.created_at ?? null;
  const backupStale = lastBackupAt
    ? Date.now() - new Date(lastBackupAt).getTime() > 8 * 24 * 60 * 60 * 1000
    : true;

  // ─── Overall health score ────────────────────────────────────────────
  const checks = [
    triggerCount24h > 0, // system actually doing things
    failedSendCount === 0, // no broken sends
    !dryingAuditStale, // audit cron firing
    pendingApprovalCount < 20, // approvals not piling up
    !backupStale, // backups recent
  ];
  const passing = checks.filter(Boolean).length;
  const overallStatus =
    passing === checks.length
      ? "all_good"
      : passing >= checks.length - 1
        ? "minor"
        : "degraded";
  const statusBadge =
    overallStatus === "all_good"
      ? { label: "All systems healthy", color: "bg-green-500/20 text-green-300 border-green-500/40" }
      : overallStatus === "minor"
        ? { label: "1 minor issue", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" }
        : { label: "Multiple issues", color: "bg-red-500/20 text-red-300 border-red-500/40" };

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Settings
        </Link>
        <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">System Health</h1>
            <p className="text-zinc-400 text-sm mt-0.5">
              Is the system breathing? Quick view of agent activity, failed sends, audits, and backups.
            </p>
          </div>
          <span
            className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusBadge.color}`}
          >
            {passing}/{checks.length} · {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Health checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Check
          ok={triggerCount24h > 0}
          title="Auto-triggers firing"
          detail={`${triggerCount24h} system actions in last 24h`}
          fixHint="If 0, agents may not be running. Check after() in actions/."
        />
        <Check
          ok={failedSendCount === 0}
          title="Email delivery"
          detail={
            failedSendCount === 0
              ? "All recent legal-doc sends succeeded"
              : `${failedSendCount} failed/skipped send${failedSendCount === 1 ? "" : "s"} in last 7d`
          }
          fixHint="Check Resend dashboard. Verify domain still healthy."
        />
        <Check
          ok={!dryingAuditStale}
          title="Drying-cert audit cron"
          detail={
            dryingAuditAgo
              ? `Last ran ${fmtAgo(dryingAuditAgo)}`
              : "Never run — cron may not be firing"
          }
          fixHint="Vercel cron: Mondays at 4:23 PM UTC. Check vercel.json + CRON_SECRET."
        />
        <Check
          ok={pendingApprovalCount < 20}
          title="Approvals queue"
          detail={
            pendingApprovalCount === 0
              ? "Queue is empty"
              : `${pendingApprovalCount} pending${oldestApprovalDays != null ? ` · oldest ${oldestApprovalDays}d` : ""}`
          }
          fixHint="Office reviews approvals at /approvals."
        />
        <Check
          ok={!backupStale}
          title="Database backup"
          detail={
            lastBackupAt
              ? `Last successful backup ${fmtAgo(lastBackupAt)}`
              : "No successful backup recorded"
          }
          fixHint="Cron: Sundays at 3 AM UTC. Check /api/cron/backup."
        />
        <Check
          ok={totalOutcomes7d > 0}
          title="Recursive feedback loop"
          detail={
            totalOutcomes7d > 0
              ? `${totalOutcomes7d} outcome${totalOutcomes7d === 1 ? "" : "s"} logged in last 7d`
              : "No outcomes yet — agents won't self-improve until corrections start logging"
          }
          fixHint="Approve/edit/reject estimates and legal docs to feed the loop."
        />
      </div>

      {/* Agent feedback breakdown */}
      {totalOutcomes7d > 0 && (
        <div className="glass-card p-5 mb-6">
          <h2 className="text-white font-semibold mb-3">Agent Feedback (last 7d)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {["argus", "ledger", "esquire", "solomon", "hunter", "extract"].map((a) => {
              const c = outcomesByAgent.get(a) ?? 0;
              return (
                <div
                  key={a}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center"
                >
                  <p className="text-zinc-400 text-[10px] uppercase tracking-wide capitalize">{a}</p>
                  <p className={`text-2xl font-bold font-mono mt-1 ${c > 0 ? "text-green-400" : "text-zinc-600"}`}>
                    {c}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-zinc-500 text-xs mt-3 leading-relaxed">
            Each row of feedback is fuel for the next draft. Agents read their last 5
            corrections per task as in-context examples — no retraining required.
          </p>
        </div>
      )}

      {/* Footnote */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">What this page is for</p>
        <p>
          A 30-second health check before you walk into your day. If anything's red,
          the fix hint tells you where to dig. This page reads from{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">audit_logs</code>,{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">legal_documents</code>,{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">agent_outcomes</code>,{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">pending_approvals</code>, and{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">backups_log</code> — no extra
          monitoring infrastructure required.
        </p>
      </div>
    </div>
  );
}

function Check({
  ok,
  title,
  detail,
  fixHint,
}: {
  ok: boolean;
  title: string;
  detail: string;
  fixHint: string;
}) {
  return (
    <div
      className={`border rounded-xl p-4 ${
        ok
          ? "bg-green-500/5 border-green-500/20"
          : "bg-yellow-500/5 border-yellow-500/30"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 leading-none mt-0.5">
          {ok ? "✅" : "⚠️"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">{title}</p>
          <p className="text-zinc-300 text-xs mt-0.5">{detail}</p>
          {!ok && (
            <p className="text-zinc-500 text-[10px] mt-1.5 italic leading-relaxed">
              Fix hint: {fixHint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
