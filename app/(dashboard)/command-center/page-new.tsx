import { getCurrentUser } from "@/lib/auth-helpers";
import { loadCommandCenterData, type ShellData } from "@/lib/command-center-data";
import { redirect } from "next/navigation";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { PanelHeader, CountChip, PulseDot } from "@/components/ui/glass-v2";
import { Badge, statusVariant } from "@/components/ui/badge";
import { SlideUp } from "@/components/ui/motion-primitives";

export const dynamic = "force-dynamic";

export default async function CommandCenterPageNew() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const data: ShellData = await loadCommandCenterData({
    name: me.name?.split(" ")[0] ?? "there",
    role: me.role.charAt(0).toUpperCase() + me.role.slice(1),
  });

  const fmtUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

  return (
    <SlideUp>
      {/* Header */}
      <div className="mb-6">
        <PanelHeader
          title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${data.operator.name}. ${data.operator.role}`}
          sub="Command Center"
          emoji="🖥️"
          right={<CountChip count={data.agentWorkflows.length} tone="teal" />}
        />
      </div>

      {/* System Pulse */}
      <BentoGrid className="mb-6">
        <BentoCard span={3} accent="teal">
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--color-text-muted)] mb-2">Triggers 24h</p>
          <p className="text-2xl font-bold text-[color:var(--color-text-primary)]">{data.systemPulse.triggersLast24h}</p>
        </BentoCard>
        <BentoCard span={3} accent="amber">
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--color-text-muted)] mb-2">Approvals</p>
          <p className="text-2xl font-bold text-[#F59E0B]">{data.systemPulse.pendingApprovals}</p>
        </BentoCard>
        <BentoCard span={3}>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--color-text-muted)] mb-2">Failed Sends</p>
          <p className="text-2xl font-bold text-[color:var(--color-text-primary)]">{data.systemPulse.failedSends}</p>
        </BentoCard>
        <BentoCard span={3}>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--color-text-muted)] mb-2">Backup</p>
          <p className="text-2xl font-bold text-[color:var(--color-text-primary)]">{data.systemPulse.backupAgeHours}h</p>
        </BentoCard>
      </BentoGrid>

      {/* Today Metrics */}
      <BentoGrid className="mb-6">
        <BentoCard span={3} accent="blue">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-1">Calls</p>
          <p className="text-3xl font-bold text-[color:var(--color-text-primary)]">{data.todayMetrics.callsTaken}</p>
        </BentoCard>
        <BentoCard span={3} accent="blue">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-1">Jobs Created</p>
          <p className="text-3xl font-bold text-[color:var(--color-text-primary)]">{data.todayMetrics.jobsCreated}</p>
        </BentoCard>
        <BentoCard span={3} accent="teal">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-1">Revenue</p>
          <p className="text-3xl font-bold text-[#5FBDB0]">{fmtUsd.format(data.todayMetrics.revenueTouched)}</p>
        </BentoCard>
        <BentoCard span={3} accent="blue">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-1">Agent Actions</p>
          <p className="text-3xl font-bold text-[color:var(--color-text-primary)]">{data.todayMetrics.agentActions}</p>
        </BentoCard>
      </BentoGrid>

      {/* Agent Workflows */}
      <PanelHeader title="Active Agent Workflows" emoji="⚡" right={<CountChip count={data.agentWorkflows.length} tone="teal" />} />
      <BentoGrid className="mb-6">
        {data.agentWorkflows.slice(0, 4).map((wf, i) => (
          <BentoCard key={wf.id || i} span={3} accent={wf.state === "blocked" ? "amber" : wf.state === "complete" ? "teal" : "blue"}>
            <div className="flex items-center gap-2 mb-2">
              <PulseDot tone={wf.state === "complete" ? "teal" : wf.state === "blocked" ? "amber" : "blue"} />
              <span className="text-sm font-medium text-[color:var(--color-text-primary)]">{wf.agent} · {wf.intent}</span>
            </div>
            <p className="text-xs text-[color:var(--color-text-secondary)] mb-3">{wf.target}</p>
            <div className="h-1 rounded-full bg-[color:var(--color-surface)] mb-2">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${wf.progress}%`, backgroundColor: wf.state === "complete" ? "#5FBDB0" : "#6B8AD9" }} />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[color:var(--color-text-muted)]">{wf.progress}%</span>
              <Badge variant={wf.state === "complete" ? "positive" : wf.state === "blocked" ? "caution" : "primary"}>{wf.state}</Badge>
            </div>
          </BentoCard>
        ))}
      </BentoGrid>

      {/* Hand-off Stack */}
      <PanelHeader title="Hand-off" sub={data.handoffs.length > 0 ? `${data.handoffs.length} pending` : "Clear"} emoji="⚠️" right={<CountChip count={data.handoffs.length} tone={data.handoffs.length > 0 ? "amber" : "neutral"} />} />
      {data.handoffs.length === 0 ? (
        <p className="text-sm text-[color:var(--color-text-muted)] mb-6">All clear. No pending hand-offs.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {data.handoffs.map((h) => (
            <div key={h.id} className="rounded-xl p-4 border border-[color:var(--color-edge)]" style={{ backgroundColor: "var(--color-surface)", backdropFilter: "blur(24px)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{h.title}</p>
                  <p className="text-xs text-[color:var(--color-text-secondary)] mt-1">{h.detail}</p>
                </div>
                <Badge variant={h.severity === "high" ? "danger" : h.severity === "med" ? "caution" : "neutral"}>{h.severity}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-[color:var(--color-text-muted)]">
                <span>{h.agent}</span>
                <span>·</span>
                <span>{h.ageMinutes}m ago</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compute Panel */}
      <PanelHeader title="Compute" sub={fmtUsd.format(data.compute.mtdSpendUsd) + " MTD"} emoji="📊" />
      <BentoGrid>
        <BentoCard span={4} accent="blue">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">Today</p>
          <p className="text-2xl font-bold text-[color:var(--color-text-primary)]">{fmtUsd.format(data.compute.todaySpendUsd)}</p>
          <p className="text-xs text-[color:var(--color-text-muted)] mt-1">{data.compute.invocationsToday} calls</p>
        </BentoCard>
        <BentoCard span={4}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">By Tier</p>
          <div className="space-y-2">
            {(["fast", "balanced", "smart"] as const).map(tier => {
              const val = data.compute.byTier[tier];
              const total = data.compute.byTier.fast + data.compute.byTier.balanced + data.compute.byTier.smart + data.compute.byTier.unknown || 1;
              return (
                <div key={tier} className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase text-[color:var(--color-text-muted)]">{tier}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[color:var(--color-surface)]">
                    <div className="h-full rounded-full" style={{ width: `${(val / total) * 100}%`, backgroundColor: tier === "smart" ? "#6B8AD9" : tier === "balanced" ? "#5FBDB0" : "#F59E0B" }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-[color:var(--color-text-secondary)]">{fmtUsd.format(val)}</span>
                </div>
              );
            })}
          </div>
        </BentoCard>
        <BentoCard span={4}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">Last Invocations</p>
          {data.compute.lastInvocations.slice(0, 4).map((inv, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-[color:var(--color-edge)]/50 last:border-0">
              <span className="text-xs text-[color:var(--color-text-secondary)]">{inv.model}</span>
              <span className="text-[10px] tabular-nums text-[color:var(--color-text-muted)]">{fmtUsd.format(inv.cost)} · {inv.minutesAgo}m ago</span>
            </div>
          ))}
        </BentoCard>
      </BentoGrid>
    </SlideUp>
  );
}
