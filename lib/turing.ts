// Turing — the meta-agent. Reads recent feedback (agent_outcomes), system
// health signals, and surfaces concrete improvements: which agents are
// drifting, which prompts need tuning, which workflows have friction.
//
// Read-only by design. Turing never writes to other agents' state — it
// produces recommendations the human reviews.

import { anthropic, MODELS } from "./ai";
import { feedbackPreamble } from "./agent-feedback";
import { createAdminClient } from "./supabase-server";

export interface TuringInsight {
  severity: "high" | "med" | "low";
  agent: string | "system";
  category:
    | "prompt_quality"
    | "process_friction"
    | "cost_efficiency"
    | "data_gap"
    | "wins";
  observation: string;
  recommendation: string;
}

export interface TuringReport {
  summary: string;
  insights: TuringInsight[];
  data_window_days: number;
  generated_at: string;
}

const REPORT_TOOL = {
  name: "report_findings",
  description:
    "Submit Turing's audit findings. Severity drives sort order; categories let the user filter by type of improvement.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string" as const,
        description:
          "2-3 sentence executive summary of system state. Honest, non-cheerleading.",
      },
      insights: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            severity: { type: "string" as const, enum: ["high", "med", "low"] },
            agent: {
              type: "string" as const,
              description: "Which agent the insight is about, or 'system' for cross-cutting.",
            },
            category: {
              type: "string" as const,
              enum: ["prompt_quality", "process_friction", "cost_efficiency", "data_gap", "wins"],
            },
            observation: { type: "string" as const, description: "What you noticed in the data, with numbers when relevant." },
            recommendation: {
              type: "string" as const,
              description: "Concrete action — what to change in the prompt / process / config.",
            },
          },
          required: ["severity", "agent", "category", "observation", "recommendation"],
        },
      },
    },
    required: ["summary", "insights"],
  },
};

interface AggregateSnapshot {
  windowDays: number;
  outcomes: {
    total: number;
    byAgent: Array<{
      agent: string;
      total: number;
      approved_unchanged: number;
      approved_with_edits: number;
      rejected: number;
      revised: number;
    }>;
    recentDeltas: Array<{
      agent: string;
      task: string;
      outcome: string;
      delta: Record<string, unknown> | null;
    }>;
  };
  health: {
    triggerCount24h: number;
    failedSendCount: number;
    pendingApprovals: number;
    moistureReadingsLast7d: number;
    estimatesGeneratedLast7d: number;
  };
}

async function gatherSnapshot(windowDays: number): Promise<AggregateSnapshot> {
  const admin = createAdminClient();
  const sinceWindow = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: outcomes },
    { data: triggers24h },
    { data: failedSends },
    { data: pendingApprovals },
    { data: moisture7d },
    { data: estimates7d },
  ] = await Promise.all([
    admin
      .from("agent_outcomes")
      .select("agent, task, outcome, delta, created_at")
      .gte("created_at", sinceWindow)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("audit_logs")
      .select("id")
      .is("user_id", null)
      .gte("created_at", since24h),
    admin
      .from("legal_documents")
      .select("id, last_send_attempt")
      .not("last_send_attempt", "is", null)
      .gte("created_at", since7d),
    admin.from("pending_approvals").select("id").eq("status", "pending"),
    admin.from("moisture_readings").select("id").gte("created_at", since7d),
    admin.from("estimates").select("id").gte("created_at", since7d),
  ]);

  // Aggregate outcomes per agent
  const byAgentMap = new Map<string, AggregateSnapshot["outcomes"]["byAgent"][number]>();
  for (const o of (outcomes ?? []) as any[]) {
    const cur =
      byAgentMap.get(o.agent) ?? {
        agent: o.agent,
        total: 0,
        approved_unchanged: 0,
        approved_with_edits: 0,
        rejected: 0,
        revised: 0,
      };
    cur.total += 1;
    if (o.outcome === "approved_unchanged") cur.approved_unchanged += 1;
    else if (o.outcome === "approved_with_edits") cur.approved_with_edits += 1;
    else if (o.outcome === "rejected") cur.rejected += 1;
    else if (o.outcome === "revised") cur.revised += 1;
    byAgentMap.set(o.agent, cur);
  }

  const failedSendCount = (failedSends ?? []).filter(
    (d: any) =>
      d.last_send_attempt?.status === "failed" ||
      d.last_send_attempt?.status === "skipped"
  ).length;

  return {
    windowDays,
    outcomes: {
      total: outcomes?.length ?? 0,
      byAgent: Array.from(byAgentMap.values()).sort((a, b) => b.total - a.total),
      recentDeltas: ((outcomes ?? []) as any[])
        .filter((o) => o.delta && Object.keys(o.delta).length > 0)
        .slice(0, 10)
        .map((o) => ({
          agent: o.agent,
          task: o.task,
          outcome: o.outcome,
          delta: o.delta,
        })),
    },
    health: {
      triggerCount24h: triggers24h?.length ?? 0,
      failedSendCount,
      pendingApprovals: pendingApprovals?.length ?? 0,
      moistureReadingsLast7d: moisture7d?.length ?? 0,
      estimatesGeneratedLast7d: estimates7d?.length ?? 0,
    },
  };
}

export async function runTuringAudit(windowDays: number = 14): Promise<TuringReport> {
  const snapshot = await gatherSnapshot(windowDays);
  const preamble = await feedbackPreamble("solomon", "fpa_analysis", 3); // borrow Solomon's lessons — they're closest in spirit

  const message = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 4000,
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: "report_findings" },
    ...({ _agent: "turing", _task: "self_audit" } as any),
    messages: [
      {
        role: "user",
        content:
          preamble +
          `You are Turing, the self-audit / meta-agent for FirstCall OS — an AI-native restoration business OS.

Your one job: read the system snapshot below and surface CONCRETE, ACTIONABLE improvements. NO motivational speak. NO generic platitudes. Every insight must have a specific number from the data and a specific change the user can make.

Categories of insights:
- prompt_quality — agent drafts get edited often → prompt needs tuning
- process_friction — workflow has unnecessary steps or stuck approvals
- cost_efficiency — model tier could be lower / a cron is wasting calls
- data_gap — agents would benefit from data the user isn't logging (labor, consumables, moisture readings)
- wins — things that ARE working well, worth reinforcing

Be honest. If the data is too sparse to draw conclusions, say so in the summary and produce 1-2 low-severity insights about WHAT to log to fix that.

System snapshot (last ${snapshot.windowDays} days unless noted):

OUTCOMES PER AGENT:
${JSON.stringify(snapshot.outcomes.byAgent, null, 2)}

RECENT DELTAS (corrections agents got from humans):
${JSON.stringify(snapshot.outcomes.recentDeltas, null, 2)}

SYSTEM HEALTH:
- ${snapshot.health.triggerCount24h} auto-triggers fired in last 24h
- ${snapshot.health.failedSendCount} failed/skipped legal-doc sends in last 7d
- ${snapshot.health.pendingApprovals} pending approvals in queue
- ${snapshot.health.moistureReadingsLast7d} moisture readings logged last 7d
- ${snapshot.health.estimatesGeneratedLast7d} estimates generated last 7d

Submit findings via the report_findings tool. Keep insights to 5-8 total — tight, specific, prioritized by severity.`,
      },
    ],
  });

  const tool = message.content.find((b: any) => b.type === "tool_use") as any;
  const result = tool?.input ?? { summary: "No insights returned.", insights: [] };

  return {
    summary: result.summary,
    insights: result.insights ?? [],
    data_window_days: snapshot.windowDays,
    generated_at: new Date().toISOString(),
  };
}
