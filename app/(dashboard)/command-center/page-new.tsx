import { getCurrentUser } from "@/lib/auth-helpers";
import {
  loadCommandCenterData,
  type ShellData,
} from "@/lib/command-center-data";
import { redirect } from "next/navigation";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { PanelHeader, CountChip, PulseDot } from "@/components/ui/glass-v2";
import { Badge, statusVariant } from "@/components/ui/badge";
import { AgentPulse } from "@/components/ui/agentic";
import {
  FadeIn,
  SlideUp,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/motion-primitives";

export const dynamic = "force-dynamic";

// ─── Severity helpers ────────────────────────────────────────────────
const SEVERITY_BADGE: Record<string, "danger" | "caution" | "neutral"> = {
  high: "danger",
  med: "caution",
  low: "neutral",
};

// ─── Provider display helpers ────────────────────────────────────────
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  unknown: "Other",
};

const PROVIDER_TONE: Record<string, "teal" | "blue" | "amber" | "neutral"> = {
  anthropic: "teal",
  google: "blue",
  deepseek: "amber",
  openai: "neutral",
  unknown: "neutral",
};

// ─── Page ────────────────────────────────────────────────────────────

export default async function CommandCenterPageNew() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data: ShellData = await loadCommandCenterData({
    name: user.name,
    role: user.role,
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // ── Compute helpers ──────────────────────────────────────────────────
  const mtdFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(data.compute.mtdSpendUsd);

  const todayFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(data.compute.todaySpendUsd);

  // Tier bar proportions — guard against zero total
  const tierTotal =
    data.compute.byTier.fast +
    data.compute.byTier.balanced +
    data.compute.byTier.smart +
    data.compute.byTier.unknown;

  const tierPct = (v: number) =>
    tierTotal > 0 ? Math.round((v / tierTotal) * 100) : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      {/* ── 1. Page Header ─────────────────────────────────────────── */}
      <SlideUp delay={0}>
        <header className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[color:var(--color-text-muted)]">
                Command Center
              </p>
              <h1 className="text-[28px] font-semibold tracking-tight mt-1 text-[color:var(--color-text-primary)]">
                {data.operator.name}{" "}
                <span className="text-[color:var(--color-text-muted)] font-normal">
                  — {data.operator.role}
                </span>
              </h1>
              <p className="text-sm text-[color:var(--color-text-muted)] mt-1.5">
                {dateStr} · {timeStr}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AgentPulse label="System Live" active />
              <CountChip
                count={data.agentWorkflows.length}
                label="active agents"
                tone="teal"
              />
            </div>
          </div>
        </header>
      </SlideUp>

      {/* ── 2. Active Agent Workflows ──────────────────────────────── */}
      <section className="mb-10">
        <PanelHeader
          title="Active Agent Workflows"
          emoji="⚡"
          sub="Real-time agent activity across the system"
          right={
            <CountChip
              count={data.agentWorkflows.length}
              tone="teal"
            />
          }
        />
        <BentoGrid>
          {data.agentWorkflows.map((wf, i) => (
            <BentoCard
              key={wf.id}
              span={wf.state === "blocked" ? 6 : 3}
              accent={wf.state === "blocked" ? "amber" : wf.state === "complete" ? "teal" : "blue"}
              delay={i}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{wf.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                      {wf.agent}
                    </p>
                    <p className="text-[11px] text-[color:var(--color-text-muted)]">
                      {wf.intent}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      wf.state === "complete"
                        ? "positive"
                        : wf.state === "blocked"
                          ? "caution"
                          : "primary"
                    }
                  >
                    {wf.state === "complete"
                      ? "Done"
                      : wf.state === "blocked"
                        ? "Awaiting"
                        : "Active"}
                  </Badge>
                  {wf.state === "processing" && <PulseDot tone="teal" />}
                  {wf.state === "blocked" && <PulseDot tone="amber" />}
                </div>
              </div>

              {/* Target / detail */}
              <p className="text-xs text-[color:var(--color-text-secondary)] mb-3 truncate">
                {wf.target}
              </p>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[color:var(--color-text-muted)]">
                    Progress
                  </span>
                  <span className="font-mono tabular-nums text-[color:var(--color-text-secondary)]">
                    {Math.round(wf.progress * 100)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[color:var(--color-surface)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.round(wf.progress * 100)}%`,
                      backgroundColor:
                        wf.state === "blocked"
                          ? "var(--color-caution)"
                          : wf.state === "complete"
                            ? "var(--color-positive)"
                            : "var(--color-primary)",
                    }}
                  />
                </div>
              </div>

              {/* ETA */}
              {wf.etaMin > 0 && (
                <p className="text-[10px] text-[color:var(--color-text-muted)] mt-2">
                  ETA: ~{wf.etaMin} min
                </p>
              )}
            </BentoCard>
          ))}
        </BentoGrid>
      </section>

      {/* ── 3. Today Metrics 4-up ──────────────────────────────────── */}
      <section className="mb-10">
        <PanelHeader
          title="Today"
          emoji="📊"
          sub="Operational snapshot since midnight"
        />
        <BentoGrid>
          <BentoCard span={3} accent="teal" delay={0}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[color:var(--color-text-muted)] mb-1">
              Calls Taken
            </p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-[color:var(--color-positive)]">
              {data.todayMetrics.callsTaken}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">
              Inbound calls processed
            </p>
          </BentoCard>

          <BentoCard span={3} accent="blue" delay={1}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[color:var(--color-text-muted)] mb-1">
              Jobs Created
            </p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-[color:var(--color-primary)]">
              {data.todayMetrics.jobsCreated}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">
              New jobs opened today
            </p>
          </BentoCard>

          <BentoCard span={3} accent="neutral" delay={2}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[color:var(--color-text-muted)] mb-1">
              Revenue Touched
            </p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-[color:var(--color-text-primary)]">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(data.todayMetrics.revenueTouched)}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">
              Sent invoices today
            </p>
          </BentoCard>

          <BentoCard span={3} accent="teal" delay={3}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[color:var(--color-text-muted)] mb-1">
              Agent Actions
            </p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-[color:var(--color-text-secondary)]">
              {data.todayMetrics.agentActions}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">
              AI agent actions in 24h
            </p>
          </BentoCard>
        </BentoGrid>
      </section>

      {/* ── 4. Job Pulse + Hand-off Stack ──────────────────────────── */}
      <section className="mb-10">
        <BentoGrid>
          {/* Job Pulse */}
          <BentoCard span={6} accent="blue" delay={0}>
            <PanelHeader
              title="Job Pulse"
              emoji="📋"
              sub="Active jobs — recency-sorted"
              right={
                <CountChip count={data.jobPulse.length} tone="blue" />
              }
            />
            <StaggerContainer className="space-y-2">
              {data.jobPulse.length === 0 && (
                <p className="text-sm text-[color:var(--color-text-muted)] py-6 text-center">
                  No active jobs
                </p>
              )}
              {data.jobPulse.map((job) => (
                <StaggerItem key={job.id}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-edge)]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[color:var(--color-text-muted)]">
                          {job.number}
                        </span>
                        <span className="text-sm font-medium text-[color:var(--color-text-primary)] truncate">
                          {job.customer}
                        </span>
                      </div>
                      <p className="text-[10px] text-[color:var(--color-text-muted)] mt-0.5 truncate">
                        {job.site}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant={statusVariant(job.status)}>
                        {job.status}
                      </Badge>
                      <span className="text-[10px] text-[color:var(--color-text-muted)] tabular-nums">
                        {job.lastTouchMin > 120
                          ? `${Math.floor(job.lastTouchMin / 60)}h`
                          : `${job.lastTouchMin}m`}
                      </span>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </BentoCard>

          {/* Hand-off Stack */}
          <BentoCard span={6} accent="amber" delay={1}>
            <PanelHeader
              title="Hand-off Stack"
              emoji="🤝"
              sub="Pending approvals requiring your attention"
              right={
                <CountChip
                  count={data.handoffs.length}
                  tone={data.handoffs.length > 0 ? "amber" : "neutral"}
                />
              }
            />
            <StaggerContainer className="space-y-2">
              {data.handoffs.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[color:var(--color-text-muted)] text-sm">
                    ✓ All clear — nothing awaiting review
                  </p>
                </div>
              )}
              {data.handoffs.map((h) => (
                <StaggerItem key={h.id}>
                  <div className="p-3 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/15">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={SEVERITY_BADGE[h.severity] ?? "neutral"}>
                            {h.severity}
                          </Badge>
                          <span className="text-[11px] font-medium text-[color:var(--color-text-primary)]">
                            {h.agent}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[color:var(--color-text-primary)] truncate">
                          {h.title}
                        </p>
                        <p className="text-[11px] text-[color:var(--color-text-secondary)] mt-0.5 truncate">
                          {h.detail}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-[#F59E0B] shrink-0 mt-1">
                        {h.ageMinutes > 120
                          ? `${Math.floor(h.ageMinutes / 60)}h`
                          : `${h.ageMinutes}m`}
                      </span>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </BentoCard>
        </BentoGrid>
      </section>

      {/* ── 5. System Pulse + Compute ─────────────────────────────── */}
      <section className="mb-10">
        <BentoGrid>
          {/* System Pulse */}
          <BentoCard span={6} accent="neutral" delay={0}>
            <PanelHeader
              title="System Pulse"
              emoji="🫀"
              sub="Last 24 hours"
            />
            <div className="grid grid-cols-2 gap-3">
              <FadeIn delay={0.1}>
                <div className="p-3 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-edge)]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mb-1">
                    Triggers
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                    {data.systemPulse.triggersLast24h}
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.2}>
                <div className="p-3 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-edge)]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mb-1">
                    Pending
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                    {data.systemPulse.pendingApprovals}
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.3}>
                <div className="p-3 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-edge)]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mb-1">
                    Failed Sends
                  </p>
                  <p
                    className={`text-xl font-semibold tabular-nums ${
                      data.systemPulse.failedSends > 0
                        ? "text-[color:var(--color-danger)]"
                        : "text-[color:var(--color-text-primary)]"
                    }`}
                  >
                    {data.systemPulse.failedSends}
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.4}>
                <div className="p-3 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-edge)]">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mb-1">
                    Last Backup
                  </p>
                  <p
                    className={`text-xl font-semibold tabular-nums ${
                      data.systemPulse.backupAgeHours > 24
                        ? "text-[color:var(--color-danger)]"
                        : data.systemPulse.backupAgeHours > 8
                          ? "text-[color:var(--color-caution)]"
                          : "text-[color:var(--color-positive)]"
                    }`}
                  >
                    {data.systemPulse.backupAgeHours > 48
                      ? `${Math.floor(data.systemPulse.backupAgeHours / 24)}d`
                      : `${data.systemPulse.backupAgeHours}h`}
                  </p>
                </div>
              </FadeIn>
            </div>
          </BentoCard>

          {/* Compute Panel */}
          <BentoCard span={6} accent="teal" delay={1}>
            <PanelHeader
              title="Compute"
              emoji="⚙️"
              sub={`${data.compute.invocationsToday} invocations today`}
            />
            <div className="space-y-4">
              {/* MTD spend highlight */}
              <FadeIn delay={0.15}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
                    MTD Spend
                  </span>
                  <span className="text-xs text-[color:var(--color-text-muted)]">
                    Today: {todayFormatted}
                  </span>
                </div>
                <p className="text-[32px] font-semibold tracking-tight tabular-nums text-[color:var(--color-positive)]">
                  {mtdFormatted}
                </p>
              </FadeIn>

              {/* By Tier — stacked bar */}
              <FadeIn delay={0.25}>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mb-2">
                  By Tier
                </p>
                <div className="flex h-2 rounded-full overflow-hidden bg-[color:var(--color-surface)]">
                  {data.compute.byTier.fast > 0 && (
                    <div
                      className="bg-[#5FBDB0]"
                      style={{ width: `${tierPct(data.compute.byTier.fast)}%` }}
                      title={`Fast: $${data.compute.byTier.fast.toFixed(2)}`}
                    />
                  )}
                  {data.compute.byTier.balanced > 0 && (
                    <div
                      className="bg-[#6B8AD9]"
                      style={{ width: `${tierPct(data.compute.byTier.balanced)}%` }}
                      title={`Balanced: $${data.compute.byTier.balanced.toFixed(2)}`}
                    />
                  )}
                  {data.compute.byTier.smart > 0 && (
                    <div
                      className="bg-[#F59E0B]"
                      style={{ width: `${tierPct(data.compute.byTier.smart)}%` }}
                      title={`Smart: $${data.compute.byTier.smart.toFixed(2)}`}
                    />
                  )}
                  {data.compute.byTier.unknown > 0 && (
                    <div
                      className="bg-[color:var(--color-text-muted)]"
                      style={{ width: `${tierPct(data.compute.byTier.unknown)}%` }}
                      title={`Unknown: $${data.compute.byTier.unknown.toFixed(2)}`}
                    />
                  )}
                </div>
                <div className="flex gap-4 mt-1.5">
                  <span className="text-[10px] text-[color:var(--color-text-muted)]">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#5FBDB0] mr-1 align-middle" />
                    Fast ${data.compute.byTier.fast.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-[color:var(--color-text-muted)]">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#6B8AD9] mr-1 align-middle" />
                    Balanced ${data.compute.byTier.balanced.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-[color:var(--color-text-muted)]">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B] mr-1 align-middle" />
                    Smart ${data.compute.byTier.smart.toFixed(0)}
                  </span>
                </div>
              </FadeIn>

              {/* By Provider */}
              <FadeIn delay={0.35}>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mb-2">
                  By Provider
                </p>
                <div className="space-y-1.5">
                  {(
                    Object.entries(data.compute.byProvider) as [
                      string,
                      { cost: number; calls: number },
                    ][]
                  )
                    .filter(([, v]) => v.calls > 0)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([provider, { cost, calls }]) => (
                      <div
                        key={provider}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[color:var(--color-text-secondary)]">
                          {PROVIDER_LABELS[provider] ?? provider}
                        </span>
                        <span className="font-mono tabular-nums text-[color:var(--color-text-primary)]">
                          ${cost.toFixed(2)}{" "}
                          <span className="text-[color:var(--color-text-muted)] font-normal">
                            ({calls} calls)
                          </span>
                        </span>
                      </div>
                    ))}
                </div>
              </FadeIn>

              {/* Top agent + last invocations */}
              {data.compute.topAgentByCost && (
                <FadeIn delay={0.45}>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[color:var(--color-edge)]">
                    <span className="text-[color:var(--color-text-muted)]">
                      Top agent
                    </span>
                    <span className="text-[color:var(--color-text-primary)]">
                      {data.compute.topAgentByCost.agent} · $
                      {data.compute.topAgentByCost.cost.toFixed(2)}
                    </span>
                  </div>
                </FadeIn>
              )}

              {data.compute.lastInvocations.length > 0 && (
                <FadeIn delay={0.5}>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)] mt-3 mb-1.5">
                    Last Invocations
                  </p>
                  <div className="space-y-1">
                    {data.compute.lastInvocations.map((inv, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[10px]"
                      >
                        <span className="font-mono text-[color:var(--color-text-muted)] truncate mr-2 max-w-[60%]">
                          {inv.model}
                        </span>
                        <span className="tabular-nums text-[color:var(--color-text-secondary)] shrink-0">
                          ${inv.cost.toFixed(4)} · {inv.minutesAgo}m ago
                        </span>
                      </div>
                    ))}
                  </div>
                </FadeIn>
              )}
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      {/* ── Footer spacing for scroll comfort ──────────────────────── */}
      <div className="h-8" />
    </div>
  );
}
