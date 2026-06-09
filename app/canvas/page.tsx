import { getCurrentUser } from "@/lib/auth-helpers";
import { loadCommandCenterData, type ShellData } from "@/lib/command-center-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

export default async function EchoCanvasPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const data: ShellData = await loadCommandCenterData({ name: me.name?.split(" ")[0] ?? "there", role: me.role });

  const totalActive = data.agentWorkflows.filter(w => w.state === "processing").length;
  const blocked = data.agentWorkflows.filter(w => w.state === "blocked").length;
  const openJobs = data.jobPulse.length;
  const pendingApprovals = data.handoffs.length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg-deep)" }}>
      {/* Ambient atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(107,138,217,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(95,189,176,0.05) 0%, transparent 50%)" }} />
      </div>

      {/* ─── COMMAND BAR ────────────────────────────────────────── */}
      <div className="relative z-20 px-6 pt-6 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 p-4 rounded-2xl border animate-spatial-rise" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)", backdropFilter: "blur(14px)" }}>
            <span className="text-lg">⚡</span>
            <input
              type="text"
              placeholder="What do you need? Create a job, check AR, find a customer, run a report..."
              className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-[color:var(--color-text-muted)] text-[color:var(--color-text-primary)]"
              autoFocus
            />
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-strong)] border border-[color:var(--color-edge)]">⌘K</kbd>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {["New job", "Check AR", "Find customer", "Today's schedule", "Pending approvals", "Run report"].map(cmd => (
              <button key={cmd} className="px-3 py-1.5 rounded-full text-xs transition-all hover:scale-105" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-secondary)", border: "1px solid var(--color-edge)", backdropFilter: "blur(8px)" }}>
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SPATIAL CANVAS ─────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-12">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Row 1: Agent Pulse + Urgent */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Live Agents */}
            <div className="md:col-span-2 rounded-2xl p-5 border animate-spatial-rise" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)", backdropFilter: "blur(14px)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#5FBDB0] animate-ping-ambient" />
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Live Agents</p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: totalActive > 0 ? "rgba(95,189,176,0.1)" : "var(--color-surface-strong)", color: totalActive > 0 ? "#5FBDB0" : "var(--color-text-muted)" }}>
                  {totalActive} active
                </span>
              </div>
              <div className="space-y-3">
                {data.agentWorkflows.length === 0 ? (
                  <p className="text-sm text-[color:var(--color-text-muted)]">All agents idle. System is quiet.</p>
                ) : (
                  data.agentWorkflows.slice(0, 3).map((wf, i) => (
                    <div key={wf.id || i} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01] cursor-pointer" style={{ backgroundColor: wf.state === "blocked" ? "rgba(245,158,11,0.05)" : "var(--color-surface-strong)" }}>
                      <span className="text-lg">{wf.icon || "🤖"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[color:var(--color-text-primary)] truncate">{wf.agent} · {wf.intent}</p>
                        <p className="text-xs text-[color:var(--color-text-muted)] truncate">{wf.target}</p>
                      </div>
                      <div className="w-16 h-1 rounded-full bg-[color:var(--color-surface)]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${wf.progress}%`, backgroundColor: wf.state === "complete" ? "#5FBDB0" : wf.state === "blocked" ? "#F59E0B" : "#6B8AD9" }} />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: wf.state === "complete" ? "#5FBDB0" : wf.state === "blocked" ? "#F59E0B" : "#6B8AD9" }}>
                        {wf.progress}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Urgent Attention */}
            <div className="md:col-span-2 rounded-2xl p-5 border animate-spatial-rise" style={{ backgroundColor: pendingApprovals > 0 ? "rgba(245,158,11,0.04)" : "var(--color-surface)", borderColor: pendingApprovals > 0 ? "rgba(245,158,11,0.15)" : "var(--color-edge)", backdropFilter: "blur(14px)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Needs Attention</p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: pendingApprovals > 0 ? "rgba(245,158,11,0.1)" : "var(--color-surface-strong)", color: pendingApprovals > 0 ? "#F59E0B" : "var(--color-text-muted)" }}>
                  {pendingApprovals} pending
                </span>
              </div>
              {pendingApprovals === 0 ? (
                <p className="text-sm text-[color:var(--color-text-secondary)]">Nothing needs your approval right now. 🎉</p>
              ) : (
                <div className="space-y-2">
                  {data.handoffs.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:scale-[1.01] transition-all" style={{ backgroundColor: "var(--color-surface-strong)" }}>
                      <span className="text-lg">{h.severity === "high" ? "🔴" : h.severity === "med" ? "🟡" : "⚪"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{h.title}</p>
                        <p className="text-xs text-[color:var(--color-text-muted)]">{h.detail} · {h.ageMinutes}m ago</p>
                      </div>
                      <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105" style={{ backgroundColor: "var(--color-primary)" }}>
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Pulse Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Triggers 24h", value: data.systemPulse.triggersLast24h, tone: "teal" as const },
              { label: "Open Jobs", value: openJobs, tone: "blue" as const },
              { label: "MTD AI Spend", value: fmtUsd.format(data.compute.mtdSpendUsd), tone: "amber" as const },
              { label: "Backup Age", value: `${data.systemPulse.backupAgeHours}h`, tone: "neutral" as const },
            ].map((m, i) => (
              <div key={i} className="rounded-2xl p-4 border animate-spatial-rise" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)", backdropFilter: "blur(12px)" }}>
                <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--color-text-muted)] mb-2">{m.label}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: m.tone === "teal" ? "#5FBDB0" : m.tone === "amber" ? "#F59E0B" : m.tone === "blue" ? "#6B8AD9" : "var(--color-text-primary)" }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Row 3: Job Pulse + Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active Jobs */}
            <div className="md:col-span-2 rounded-2xl p-5 border animate-spatial-rise" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)", backdropFilter: "blur(14px)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">📋 Active Jobs</p>
                <span className="text-[10px] text-[color:var(--color-text-muted)]">{openJobs} jobs</span>
              </div>
              <div className="space-y-2">
                {data.jobPulse.slice(0, 5).map(job => (
                  <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl hover:scale-[1.01] transition-all cursor-pointer" style={{ backgroundColor: "var(--color-surface-strong)" }}>
                    <span className="text-sm font-mono text-[color:var(--color-text-muted)] tabular-nums">{job.number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[color:var(--color-text-primary)] truncate">{job.customer}</p>
                      <p className="text-xs text-[color:var(--color-text-muted)] truncate">{job.site} · last touch {job.lastTouchMin}m ago</p>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-text-secondary)", border: "1px solid var(--color-edge)" }}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl p-5 border animate-spatial-rise" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)", backdropFilter: "blur(14px)" }}>
              <p className="text-sm font-semibold text-[color:var(--color-text-primary)] mb-4">⚡ Quick Actions</p>
              <div className="space-y-2">
                {[
                  { label: "Log a call", emoji: "📞", href: "/calls/new" },
                  { label: "Create job", emoji: "➕", href: "/jobs/new" },
                  { label: "Take photos", emoji: "📸", href: "/my-day" },
                  { label: "Run AR report", emoji: "💰", href: "/reports/ar" },
                  { label: "Check schedule", emoji: "📅", href: "/schedule" },
                ].map(action => (
                  <a key={action.label} href={action.href} className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] block" style={{ backgroundColor: "var(--color-surface-strong)" }}>
                    <span className="text-base">{action.emoji}</span>
                    <span className="text-sm text-[color:var(--color-text-primary)]">{action.label}</span>
                    <span className="ml-auto text-xs text-[color:var(--color-text-muted)]">→</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4">
            <p className="text-[10px] text-[color:var(--color-text-muted)]">
              {data.operator.name} · {data.operator.role} · {data.compute.invocationsToday} AI calls today · {fmtUsd.format(data.compute.todaySpendUsd)} spent
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
