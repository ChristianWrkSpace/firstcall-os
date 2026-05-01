// Isolated presentation layer — mounts the CommandCenterShell with mock data.
// Swap the mock for real data later by replacing the props on this page only;
// the shell itself accepts everything via props and has no backend coupling.

import CommandCenterShell from "./CommandCenterShell";
import type { ShellData } from "./CommandCenterShell";

export const dynamic = "force-dynamic";

const MOCK: ShellData = {
  operator: { name: "Christian", role: "Owner" },
  agentWorkflows: [
    {
      id: "w1",
      agent: "Hydra",
      icon: "💧",
      intent: "Validating drying logs",
      target: "Claim #FCM-202604-0003 · Smith Residence",
      progress: 0.68,
      etaMin: 4,
      state: "processing",
    },
    {
      id: "w2",
      agent: "Argus",
      icon: "👁",
      intent: "Scoping site photos (IICRC S500)",
      target: "Job #FCM-202604-0005 · 5800 Manchaca Rd",
      progress: 0.42,
      etaMin: 9,
      state: "processing",
    },
    {
      id: "w3",
      agent: "Esquire",
      icon: "⚖",
      intent: "Drafting Drying Certificate",
      target: "Smith Residence · ready in 30s",
      progress: 0.91,
      etaMin: 1,
      state: "processing",
    },
    {
      id: "w4",
      agent: "Solomon",
      icon: "🧠",
      intent: "Analyzing carrier DSO trend",
      target: "State Farm · last 90d",
      progress: 1,
      etaMin: 0,
      state: "complete",
    },
  ],
  handoffs: [
    {
      id: "h1",
      agent: "Esquire",
      title: "Approve AOB before send",
      detail: "Carlos Castro · FCM-202604-0004 · auto-drafted from intake.",
      severity: "high",
      ageMinutes: 3,
    },
    {
      id: "h2",
      agent: "Ledger",
      title: "Estimate v2 ready for review",
      detail: "Chris job · 17 line items · $5,455.70 · +5% over Argus baseline.",
      severity: "med",
      ageMinutes: 22,
    },
  ],
  jobPulse: [
    { id: "j1", number: "FCM-202604-0001", customer: "Sarah Johnson", status: "lead", site: "Austin", lastTouchMin: 12 },
    { id: "j2", number: "FCM-202604-0002", customer: "Chris", status: "mitigation", site: "Austin", lastTouchMin: 45 },
    { id: "j3", number: "FCM-202604-0003", customer: "John Smith", status: "drying", site: "Austin", lastTouchMin: 8 },
    { id: "j4", number: "FCM-202604-0004", customer: "Carlos Castro", status: "lead", site: "Austin", lastTouchMin: 3 },
  ],
  todayMetrics: {
    callsTaken: 7,
    jobsCreated: 3,
    revenueTouched: 18420,
    agentActions: 24,
  },
  systemPulse: {
    triggersLast24h: 47,
    pendingApprovals: 2,
    failedSends: 0,
    backupAgeHours: 6,
  },
};

export default function CommandCenterPage() {
  return <CommandCenterShell data={MOCK} />;
}
