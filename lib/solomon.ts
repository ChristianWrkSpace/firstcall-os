// Solomon — FP&A & Margin Analysis (server-only)
// Reads aggregated business data and uses Claude Opus 4.7 to surface
// margin leaks, low-revenue zips, slow-pay carriers, pricing tweaks.
//
// We don't have internal cost data on jobs (no labor + COGS tables yet),
// so "margin" here is really *revenue and cash-cycle* analysis. Solomon
// flags concentration risks, pricing outliers vs the company's own baseline,
// and bad-acting carriers that drag DSO. When we add cost tracking later,
// the same prompt can extend to gross-margin proper.

import { anthropic, MODELS } from "./ai";
import type { SolomonAnalysisResult } from "./solomon-types";

export interface JobAggregate {
  job_count: number;
  total_billed: number; // sum of invoice line_totals
  total_collected: number; // sum of payment amounts
  avg_ticket: number;
  by_zip: Array<{ zip: string; jobs: number; billed: number; avg_ticket: number }>;
  by_type: Array<{ type: string; jobs: number; billed: number; avg_ticket: number }>;
  by_carrier: Array<{
    carrier: string;
    jobs: number;
    billed: number;
    collected: number;
    avg_days_to_pay: number | null;
    open_balance: number;
  }>;
  outstanding_30: number; // 0-30 days
  outstanding_60: number; // 31-60
  outstanding_90: number; // 61-90
  outstanding_over: number; // 90+
  window_days: number;
}

export async function runSolomonAnalysis(
  agg: JobAggregate
): Promise<SolomonAnalysisResult> {
  const summary = JSON.stringify(agg, null, 2);

  const message = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 4000,
    // NOTE: cannot enable thinking when tool_choice forces a specific tool.
    // The structured tool_use already gives us reliable output shape;
    // adaptive reasoning happens implicitly inside the tool call.
    tools: [
      {
        name: "report_findings",
        description:
          "Submit the FP&A analysis. Insights are observations + severity; recommendations are actionable next steps with priority.",
        input_schema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description:
                "2-3 sentence executive summary of the financial picture in this window.",
            },
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["revenue", "carrier", "geography", "type", "operations", "pricing"],
                  },
                  severity: { type: "string", enum: ["info", "watch", "alert"] },
                  headline: { type: "string" },
                  detail: { type: "string" },
                  metric: { type: "string" },
                  evidence: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["category", "severity", "headline", "detail", "metric"],
              },
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: {
                    type: "string",
                    enum: ["now", "next_quarter", "watch"],
                  },
                  action: { type: "string" },
                  rationale: { type: "string" },
                  estimated_impact_dollars: { type: "number" },
                },
                required: ["priority", "action", "rationale"],
              },
            },
          },
          required: ["summary", "insights", "recommendations"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "report_findings" },
    messages: [
      {
        role: "user",
        content: `You are Solomon, the FP&A analyst for First Call Mitigation — an Austin TX water/fire/mold restoration company.

Your job: read the aggregated financial summary below and surface MARGIN LEAKS, GEOGRAPHIC OPPORTUNITIES, BAD CARRIERS (slow pay), PRICING OUTLIERS, and SCALING SIGNALS.

Important framing — we don't have COGS or labor cost data yet, so do NOT claim to compute gross margin. Instead, focus on:
- Revenue concentration (over-reliance on one carrier or zip)
- Cash-cycle problems (carriers with high avg-days-to-pay or open balances)
- Geographic outliers (a zip with notably below-baseline avg ticket)
- Job-type mix (e.g., mold remediation is higher-ticket than water — are we leaving demand on the table)
- Pricing baseline vs outliers (a zip whose avg ticket is materially below the company-wide avg)
- Aging buckets (anything in 90+ is a fire — call it out)

DATA — last ${agg.window_days} days:
${summary}

CONTEXT NOTES:
- Austin, TX. Standard water-mitigation ticket usually $3-6K; fire and mold often higher.
- Texas Insurance Code § 542.058 gives carriers 60 days to pay → anything past that bucket warrants escalation.
- "carrier = (none)" rows are cash-pay or unknown.
- A zip with <3 jobs is too small to draw conclusions from — call it out as "watch" not "alert".

REQUIREMENTS:
- 3-7 insights ranked by importance.
- 2-5 recommendations, all action-oriented and specific.
- Use real numbers from the data in metric strings (e.g., "$3,420 avg ticket in 78704 vs $4,120 company baseline").
- "now" priority = act this week. "next_quarter" = strategic. "watch" = keep an eye on it.
- Be honest. If volume is too low for confident analysis, say so in the summary instead of fabricating insights.
- If estimated_impact_dollars is uncertain, OMIT the field — do not guess.

Submit via the report_findings tool.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b: any) => b.type === "tool_use" && b.name === "report_findings"
  ) as any;

  if (!toolUse) {
    throw new Error("Solomon failed to submit a structured report.");
  }

  return toolUse.input as SolomonAnalysisResult;
}
