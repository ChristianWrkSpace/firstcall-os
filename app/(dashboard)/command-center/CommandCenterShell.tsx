"use client";

/**
 * CommandCenterShell — Industrial Glassmorphism dashboard shell.
 *
 * Strict presentation layer:
 *   • Accepts ALL data via the `data` prop (typed below).
 *   • No imports from server actions, Supabase, auth, or any business logic.
 *   • Built with inline minimalist SVGs (no lucide-react required) and pure CSS
 *     keyframes (no framer-motion required) so it drops into the existing
 *     build with zero new dependencies.
 *   • Self-mounted styles: animations live in a single <style jsx global>
 *     block so the shell is portable to any route without globals.css edits.
 *
 * Design tokens:
 *   • Foundation:  #0E1012 → #1A1C1E (deep slate)
 *   • Surface:     rgba(255,255,255,0.03–0.06) with backdrop-blur-2xl
 *   • Edge:        rgba(255,255,255,0.06–0.10) hairline borders
 *   • Healing Blue:    #6B8AD9 / #3B82F6 — primary actions
 *   • Safety Teal:     #5FBDB0 — agent-active glow + processing pulse
 *   • Intervention:    #F59E0B amber — human-in-loop hand-off cards
 *   • Type:        Geist UI inherited from layout
 *
 * Layout: 12-col Bento Grid (responsive collapse to single column under md).
 */

import { useMemo, useState } from "react";

// ─── Types — replace MOCK in page.tsx with real fetch later ──────────────
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
}

export interface AgentWorkflow {
  id: string;
  agent: string;
  icon: string;       // emoji or single-char glyph
  intent: string;     // "Validating drying logs"
  target: string;     // "Claim #FCM-202604-0003 · Smith Residence"
  progress: number;   // 0..1
  etaMin: number;     // 0 if complete
  state: "processing" | "complete" | "blocked";
}

export interface Handoff {
  id: string;
  agent: string;
  title: string;
  detail: string;
  severity: "high" | "med" | "low";
  ageMinutes: number;
}

export interface JobPulseEntry {
  id: string;
  number: string;
  customer: string;
  status: "lead" | "inspection" | "mitigation" | "drying" | "reconstruction" | "completed" | string;
  site: string;
  lastTouchMin: number;
}

// ─── Status palette (mirrors existing Tailwind class shapes elsewhere) ───
const STATUS_DOT: Record<string, string> = {
  lead:           "bg-blue-400",
  inspection:     "bg-yellow-400",
  mitigation:     "bg-orange-400",
  drying:         "bg-purple-400",
  reconstruction: "bg-indigo-400",
  completed:      "bg-emerald-400",
};

// ─── The Shell ───────────────────────────────────────────────────────────
export default function CommandCenterShell({ data }: { data: ShellData }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0E1012] text-white/[0.92]">
      {/* Ambient backdrop — slow gradient sweep + grain for depth */}
      <BackdropAtmosphere />

      <div className="relative z-10 px-4 md:px-8 pt-6 pb-16 max-w-[1600px] mx-auto">
        {/* Top bar */}
        <ShellHeader operator={data.operator} systemPulse={data.systemPulse} />

        {/* Multimodal command bar */}
        <div className="mt-6">
          <CommandBar />
        </div>

        {/* Bento Grid — 12 col on desktop, stacks under md */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Agent Workflows — wide, top-left, the headline of the dashboard */}
          <section className="md:col-span-8 row-span-2">
            <AgentWorkflowsPanel workflows={data.agentWorkflows} />
          </section>

          {/* Hand-off stack — upper right, amber-accented */}
          <section className="md:col-span-4">
            <HandoffStack handoffs={data.handoffs} />
          </section>

          {/* Today metrics — narrow, right of workflows on row 2 */}
          <section className="md:col-span-4">
            <TodayMetrics metrics={data.todayMetrics} />
          </section>

          {/* Job pulse — full width below */}
          <section className="md:col-span-12">
            <JobPulsePanel jobs={data.jobPulse} />
          </section>
        </div>
      </div>

      <ShellStyles />
    </div>
  );
}

// ─── Header — operator chip + system pulse strip ─────────────────────────
function ShellHeader({
  operator,
  systemPulse,
}: {
  operator: ShellData["operator"];
  systemPulse: ShellData["systemPulse"];
}) {
  const allHealthy =
    systemPulse.failedSends === 0 &&
    systemPulse.backupAgeHours < 168 &&
    systemPulse.triggersLast24h > 0;

  return (
    <header className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] flex items-center justify-center shadow-[0_0_24px_rgba(95,189,176,0.25)]">
          <span className="text-white font-bold tracking-tight">FC</span>
          <span className="absolute -inset-px rounded-xl ring-1 ring-white/20 pointer-events-none" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Command Center</p>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">
            Good morning, {operator.name}.
            <span className="ml-2 text-white/40 font-normal text-sm">{operator.role}</span>
          </h1>
        </div>
      </div>

      {/* System pulse strip */}
      <Glass
        className="flex items-center gap-4 px-4 py-2"
        accent={allHealthy ? "teal" : "amber"}
      >
        <PulseDot color={allHealthy ? "#5FBDB0" : "#F59E0B"} />
        <div className="text-xs flex items-center gap-4">
          <Stat label="Triggers 24h" value={systemPulse.triggersLast24h} />
          <Sep />
          <Stat
            label="Approvals"
            value={systemPulse.pendingApprovals}
            tone={systemPulse.pendingApprovals > 0 ? "amber" : "neutral"}
          />
          <Sep />
          <Stat
            label="Failed sends"
            value={systemPulse.failedSends}
            tone={systemPulse.failedSends > 0 ? "red" : "neutral"}
          />
          <Sep />
          <Stat
            label="Backup"
            value={`${systemPulse.backupAgeHours}h`}
            tone={systemPulse.backupAgeHours > 168 ? "amber" : "neutral"}
          />
        </div>
      </Glass>
    </header>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "amber" | "red";
}) {
  const c =
    tone === "amber" ? "text-amber-300" : tone === "red" ? "text-red-400" : "text-white/90";
  return (
    <div className="leading-tight">
      <p className="text-[9px] uppercase tracking-[0.15em] text-white/35">{label}</p>
      <p className={`font-mono text-sm ${c}`}>{value}</p>
    </div>
  );
}

function Sep() {
  return <span className="h-6 w-px bg-white/10" />;
}

// ─── Multimodal Command Bar ──────────────────────────────────────────────
function CommandBar() {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [recording, setRecording] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        // Drop is a no-op in the isolated shell — wire to a real handler later.
      }}
      className={`relative rounded-2xl border backdrop-blur-2xl transition-all duration-300
        ${dragOver
          ? "border-[#5FBDB0]/60 bg-[#5FBDB0]/5 shadow-[0_0_40px_rgba(95,189,176,0.25)]"
          : "border-white/[0.07] bg-white/[0.025]"}
      `}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <SearchIcon className="text-white/40 shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            dragOver
              ? "Drop photos to dispatch Argus…"
              : "Ask anything · drop photos · /command · ⌘K"
          }
          className="flex-1 bg-transparent outline-none text-sm md:text-base placeholder:text-white/35 text-white/90"
        />

        <div className="flex items-center gap-1.5">
          <ModeChip label="⌘K" />
          <button
            type="button"
            onClick={() => setRecording((r) => !r)}
            aria-label="Voice"
            className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors
              ${recording
                ? "bg-[#5FBDB0]/15 text-[#5FBDB0] ring-1 ring-[#5FBDB0]/40"
                : "text-white/50 hover:text-white/90 hover:bg-white/5"}
            `}
          >
            {recording ? <PulseMicIcon /> : <MicIcon />}
          </button>
          <button
            type="button"
            aria-label="Attach"
            className="h-8 w-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors"
          >
            <PaperclipIcon />
          </button>
          <button
            type="button"
            disabled={!text.trim() && !recording}
            className="ml-1 h-8 px-3 rounded-xl bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(107,138,217,0.25)] hover:shadow-[0_0_22px_rgba(95,189,176,0.35)] transition-shadow"
          >
            Dispatch →
          </button>
        </div>
      </div>

      {/* Context hints below */}
      <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
        <Hint>📸 Drop site photos → Argus auto-scopes</Hint>
        <Hint>🎙 Voice memo → transcribed to job notes</Hint>
        <Hint>/new job · /log labor · /run audit</Hint>
      </div>

      {dragOver && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none animate-shimmer-border" />
      )}
    </div>
  );
}

function ModeChip({ label }: { label: string }) {
  return (
    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-white/50">
      {label}
    </span>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-white/35 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
      {children}
    </span>
  );
}

// ─── Agent Workflows Panel — the headline ───────────────────────────────
function AgentWorkflowsPanel({ workflows }: { workflows: AgentWorkflow[] }) {
  return (
    <Glass className="p-5 h-full" accent="teal" subtle>
      <PanelHeader
        title="Active Agent Workflows"
        sub="Live intent — what each agent is doing right now"
        right={
          <CountChip
            count={workflows.filter((w) => w.state === "processing").length}
            label="processing"
          />
        }
      />
      <ul className="mt-4 flex flex-col gap-2.5">
        {workflows.map((w, i) => (
          <WorkflowRow key={w.id} workflow={w} animateInDelayMs={i * 80} />
        ))}
      </ul>
    </Glass>
  );
}

function WorkflowRow({
  workflow,
  animateInDelayMs,
}: {
  workflow: AgentWorkflow;
  animateInDelayMs: number;
}) {
  const isActive = workflow.state === "processing";
  const isDone = workflow.state === "complete";
  return (
    <li
      className="relative rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3.5 animate-rise-in"
      style={{ animationDelay: `${animateInDelayMs}ms` }}
    >
      {isActive && (
        <span className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-[#5FBDB0]/25 animate-pulse-soft" />
      )}
      <div className="flex items-start gap-3">
        <div
          className={`relative h-9 w-9 rounded-lg flex items-center justify-center text-base shrink-0
            ${isDone
              ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
              : "bg-[#5FBDB0]/10 text-[#A8DCD3] ring-1 ring-[#5FBDB0]/20"}
          `}
        >
          <span>{workflow.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold tracking-tight">
              <span className="text-[#A8DCD3]">{workflow.agent}</span>
              <span className="text-white/50 font-normal"> · {workflow.intent}</span>
            </p>
            <p className="text-[11px] text-white/40 font-mono">
              {isDone ? "✓ done" : `~${workflow.etaMin}m`}
            </p>
          </div>
          <p className="text-[12px] text-white/55 mt-0.5 truncate">{workflow.target}</p>
          <ProgressBar progress={workflow.progress} active={isActive} />
        </div>
      </div>
    </li>
  );
}

function ProgressBar({ progress, active }: { progress: number; active: boolean }) {
  return (
    <div className="mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          active
            ? "bg-gradient-to-r from-[#6B8AD9] to-[#5FBDB0] animate-shimmer-bg"
            : "bg-emerald-400/70"
        }`}
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
      />
    </div>
  );
}

// ─── Hand-off Stack — amber-accented human-in-loop ──────────────────────
function HandoffStack({ handoffs }: { handoffs: Handoff[] }) {
  return (
    <Glass className="p-5 h-full" accent="amber" subtle>
      <PanelHeader
        title="Hand-off"
        sub="Agents waiting on you"
        right={<CountChip count={handoffs.length} label="pending" tone="amber" />}
      />
      <ul className="mt-4 flex flex-col gap-2.5">
        {handoffs.map((h, i) => (
          <HandoffCard key={h.id} handoff={h} animateInDelayMs={i * 100} />
        ))}
        {handoffs.length === 0 && (
          <li className="text-sm text-white/40 italic px-2 py-6 text-center">
            ✓ No hand-offs — all agents proceeding autonomously.
          </li>
        )}
      </ul>
    </Glass>
  );
}

function HandoffCard({
  handoff,
  animateInDelayMs,
}: {
  handoff: Handoff;
  animateInDelayMs: number;
}) {
  return (
    <li
      className="relative rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-3.5 animate-rise-in"
      style={{ animationDelay: `${animateInDelayMs}ms` }}
    >
      <span className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-amber-400/15 animate-pulse-amber" />
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
          <HandIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-amber-100">{handoff.title}</p>
            <p className="text-[10px] text-amber-200/50 font-mono shrink-0">
              {handoff.ageMinutes}m
            </p>
          </div>
          <p className="text-[12px] text-amber-100/70 mt-0.5 leading-relaxed">
            {handoff.detail}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              type="button"
              className="text-[11px] px-2.5 py-1 rounded-md bg-amber-400/15 hover:bg-amber-400/25 text-amber-100 border border-amber-400/30 font-medium transition-colors"
            >
              Review →
            </button>
            <button
              type="button"
              className="text-[11px] px-2.5 py-1 rounded-md hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
            >
              Snooze 1h
            </button>
            <span className="ml-auto text-[10px] text-amber-200/40">{handoff.agent}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

// ─── Today Metrics — narrow KPIs ────────────────────────────────────────
function TodayMetrics({ metrics }: { metrics: ShellData["todayMetrics"] }) {
  return (
    <Glass className="p-5 h-full" subtle>
      <PanelHeader title="Today" sub="As of now" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile label="Calls" value={metrics.callsTaken} accent="blue" />
        <MetricTile label="Jobs created" value={metrics.jobsCreated} accent="teal" />
        <MetricTile
          label="Revenue touched"
          value={`$${metrics.revenueTouched.toLocaleString()}`}
          accent="emerald"
        />
        <MetricTile label="Agent actions" value={metrics.agentActions} accent="violet" />
      </div>
    </Glass>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: "blue" | "teal" | "emerald" | "violet";
}) {
  const ring =
    accent === "blue"
      ? "ring-blue-400/15"
      : accent === "teal"
        ? "ring-[#5FBDB0]/20"
        : accent === "emerald"
          ? "ring-emerald-400/20"
          : "ring-violet-400/20";
  const text =
    accent === "blue"
      ? "text-blue-200"
      : accent === "teal"
        ? "text-[#A8DCD3]"
        : accent === "emerald"
          ? "text-emerald-300"
          : "text-violet-200";
  return (
    <div className={`rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ${ring} p-3`}>
      <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">{label}</p>
      <p className={`text-xl font-semibold tracking-tight mt-1 ${text}`}>{value}</p>
    </div>
  );
}

// ─── Job Pulse — full width strip ───────────────────────────────────────
function JobPulsePanel({ jobs }: { jobs: JobPulseEntry[] }) {
  const sorted = useMemo(
    () => [...jobs].sort((a, b) => a.lastTouchMin - b.lastTouchMin),
    [jobs]
  );
  return (
    <Glass className="p-5" subtle>
      <PanelHeader
        title="Active Job Pulse"
        sub="Sorted by most recent activity"
        right={<CountChip count={jobs.length} label="open" />}
      />
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sorted.map((j, i) => (
          <li
            key={j.id}
            className="rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3 animate-rise-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-white/45">{j.number}</span>
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[j.status] ?? "bg-zinc-500"}`} />
                <span className="text-[10px] uppercase tracking-wide text-white/55 capitalize">
                  {j.status}
                </span>
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold tracking-tight truncate">{j.customer}</p>
            <p className="text-[11px] text-white/40 truncate">{j.site}</p>
            <p className="mt-2 text-[10px] text-white/35 font-mono">
              touched {j.lastTouchMin}m ago
            </p>
          </li>
        ))}
      </ul>
    </Glass>
  );
}

// ─── Reusable primitives ────────────────────────────────────────────────
function Glass({
  children,
  className = "",
  accent = "neutral",
  subtle = false,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "neutral" | "teal" | "amber";
  subtle?: boolean;
}) {
  const ring =
    accent === "teal"
      ? "ring-[#5FBDB0]/15"
      : accent === "amber"
        ? "ring-amber-400/20"
        : "ring-white/[0.04]";
  const shadow = subtle
    ? "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]"
    : "shadow-[0_12px_48px_-16px_rgba(0,0,0,0.8)]";
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl ring-1 ${ring} ${shadow} ${className}`}
    >
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-white/95">{title}</h2>
        {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function CountChip({
  count,
  label,
  tone = "teal",
}: {
  count: number;
  label: string;
  tone?: "teal" | "amber";
}) {
  const c =
    tone === "amber"
      ? "bg-amber-400/10 text-amber-300 ring-amber-400/20"
      : "bg-[#5FBDB0]/10 text-[#A8DCD3] ring-[#5FBDB0]/20";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 text-[10px] uppercase tracking-wide ${c}`}>
      <span className="font-mono text-xs">{count}</span>
      <span>{label}</span>
    </span>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="absolute inset-0 rounded-full animate-ping-slow"
        style={{ backgroundColor: color, opacity: 0.6 }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// ─── Backdrop atmosphere — subtle moving gradient + grain ───────────────
function BackdropAtmosphere() {
  return (
    <>
      {/* Soft radial glows positioned behind the glass */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(107,138,217,0.18) 0%, transparent 38%), radial-gradient(circle at 82% 88%, rgba(95,189,176,0.14) 0%, transparent 42%)",
        }}
      />
      {/* Animated drift layer */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40 animate-drift"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(107,138,217,0.06) 0%, transparent 60%)",
        }}
      />
      {/* Fine noise to break up the gradient (CSS-only via SVG data URI) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />
    </>
  );
}

// ─── Inline minimalist icons — keeps zero deps ──────────────────────────
function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
function PulseMicIcon() {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-[#5FBDB0]/40 animate-ping-slow" />
      <span className="relative h-2 w-2 rounded-full bg-[#5FBDB0]" />
    </span>
  );
}
function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5 12 21a5.5 5.5 0 1 1-7.78-7.78L13 4.5a3.5 3.5 0 1 1 5 5L9 18a1.5 1.5 0 1 1-2.12-2.12L15 7.5" />
    </svg>
  );
}
function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11V5a2 2 0 0 1 4 0v6" />
      <path d="M13 7a2 2 0 0 1 4 0v5" />
      <path d="M17 9a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7h-1a8 8 0 0 1-8-8V8a2 2 0 0 1 4 0v3" />
    </svg>
  );
}

// ─── Self-mounted styles — keyframes + utility classes ──────────────────
function ShellStyles() {
  return (
    <style jsx global>{`
      @keyframes rise-in {
        0%   { opacity: 0; transform: translateY(6px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0)   scale(1); }
      }
      .animate-rise-in {
        opacity: 0;
        animation: rise-in 420ms cubic-bezier(0.2, 0.85, 0.3, 1.05) both;
      }

      @keyframes ping-slow {
        0%   { transform: scale(1);   opacity: 0.55; }
        80%  { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      .animate-ping-slow { animation: ping-slow 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }

      @keyframes pulse-soft {
        0%, 100% { opacity: 0.20; }
        50%      { opacity: 0.55; }
      }
      .animate-pulse-soft { animation: pulse-soft 3.2s ease-in-out infinite; }

      @keyframes pulse-amber {
        0%, 100% { opacity: 0.25; }
        50%      { opacity: 0.65; }
      }
      .animate-pulse-amber { animation: pulse-amber 3.6s ease-in-out infinite; }

      @keyframes shimmer-bg {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      .animate-shimmer-bg {
        background-size: 200% 100%;
        animation: shimmer-bg 2.4s linear infinite;
      }

      @keyframes shimmer-border {
        0%   { box-shadow: 0 0 0 1px rgba(95,189,176,0.20); }
        50%  { box-shadow: 0 0 0 2px rgba(95,189,176,0.45); }
        100% { box-shadow: 0 0 0 1px rgba(95,189,176,0.20); }
      }
      .animate-shimmer-border { animation: shimmer-border 1.6s ease-in-out infinite; border-radius: 1rem; }

      @keyframes drift {
        0%   { transform: translate(0, 0) scale(1); }
        50%  { transform: translate(2%, -1%) scale(1.05); }
        100% { transform: translate(0, 0) scale(1); }
      }
      .animate-drift { animation: drift 18s ease-in-out infinite; }
    `}</style>
  );
}
