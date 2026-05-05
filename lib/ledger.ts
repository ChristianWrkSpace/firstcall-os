import { anthropic, MODELS } from "./ai";
import { feedbackPreamble } from "./agent-feedback";
import { formatPriceBookForPrompt } from "./price-book";
import type { PriceBookEntry } from "./price-book-types";
import type Anthropic from "@anthropic-ai/sdk";

// Common Xactimate codes for water mitigation. Reference for Claude.
// This is not exhaustive — Claude can output other codes if appropriate.
export const COMMON_XACTIMATE_CODES = [
  // Water Extraction
  { code: "WTR EXTB", description: "Water extraction — bonnet/wand", unit: "SF" },
  { code: "WTR EXTH", description: "Water extraction — heavy/saturated", unit: "SF" },
  { code: "WTR EXSC", description: "Water extraction — surface", unit: "SF" },
  // Drying
  { code: "WTR DRY-DAY", description: "Drying — daily monitoring", unit: "DA" },
  { code: "WTR DEHU-LR", description: "Dehumidifier — large refrigerant (LGR), per day", unit: "DA" },
  { code: "WTR DEHU-XL", description: "Dehumidifier — XL desiccant, per day", unit: "DA" },
  { code: "WTR EQDH", description: "Equipment setup/removal — dehumidifier", unit: "EA" },
  { code: "WTR EQAF", description: "Air mover, per day", unit: "DA" },
  { code: "WTR EQAS", description: "Air scrubber HEPA, per day", unit: "DA" },
  // Demolition
  { code: "DRY 1/2", description: "Drywall — 1/2\" — flood cut, 2 ft", unit: "LF" },
  { code: "DRY 1/2 4FT", description: "Drywall — 1/2\" — flood cut, 4 ft", unit: "LF" },
  { code: "BBC", description: "Detach baseboard", unit: "LF" },
  { code: "INS BATT R-13", description: "Remove batt insulation", unit: "SF" },
  { code: "INS BATT R-13 INST", description: "Install batt insulation R-13", unit: "SF" },
  // Cleaning
  { code: "WTR ANTI", description: "Antimicrobial treatment", unit: "SF" },
  { code: "CLN HEPA", description: "HEPA vacuuming", unit: "SF" },
  { code: "CLN CLEAN", description: "General cleaning", unit: "HR" },
  // Misc
  { code: "CON BAG", description: "Containment — 6 mil poly with zipper door", unit: "SF" },
  { code: "WTR EQGN", description: "Generator, per day", unit: "DA" },
  { code: "MIN", description: "Minimum charge — Water mitigation", unit: "EA" },
];

export interface LineItem {
  category?: string;
  xactimate_code?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  notes?: string;
}

export interface EstimateOutput {
  line_items: LineItem[];
  summary: string;
  assumptions: string[];
  notes_for_estimator: string;
}

const ESTIMATE_TOOL: Anthropic.Tool = {
  name: "generate_water_mitigation_estimate",
  description:
    "Generate a Xactimate-style line-item estimate for water mitigation work based on the Argus scope assessment.",
  input_schema: {
    type: "object",
    properties: {
      line_items: {
        type: "array",
        description:
          "Every billable line item. Group logically: Water Extraction → Equipment Setup → Daily Drying → Demolition → Cleaning → Misc. Use Xactimate codes when you know them. Quantities should match the affected_areas in the scope.",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: [
                "Water Extraction",
                "Equipment Setup",
                "Daily Drying",
                "Demolition",
                "Cleaning & Antimicrobial",
                "Containment",
                "Other",
              ],
            },
            xactimate_code: {
              type: "string",
              description:
                "Standard Xactimate code (e.g. WTR EXTB, WTR DEHU-LR, WTR EQAF). Leave empty if you don't know a precise code.",
            },
            description: {
              type: "string",
              description: "Plain-English description that prints on the estimate.",
            },
            quantity: { type: "number" },
            unit: {
              type: "string",
              enum: ["SF", "LF", "DA", "EA", "HR", "CY", "GAL"],
              description: "SF=square feet, LF=linear feet, DA=days, EA=each, HR=hour",
            },
            unit_price: {
              type: "number",
              description:
                "Best-effort current Austin TX market rate. Conservative estimate. The estimator will review.",
            },
            notes: { type: "string" },
          },
          required: ["category", "description", "quantity", "unit", "unit_price"],
        },
      },
      summary: {
        type: "string",
        description: "One-paragraph summary of the estimate scope and total approach.",
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        description:
          "Every pricing/scope assumption the estimator should verify (e.g., 'unit prices are 2026 Austin TX market average', 'assumed 4-day drying — may extend')",
      },
      notes_for_estimator: {
        type: "string",
        description:
          "What the human estimator should double-check before sending. Be honest about uncertainty.",
      },
    },
    required: ["line_items", "summary", "assumptions", "notes_for_estimator"],
  },
};

export async function generateEstimate(
  jobContext: string,
  scope: any,
  priceBook: Map<string, PriceBookEntry> = new Map()
): Promise<EstimateOutput> {
  const codeReference = COMMON_XACTIMATE_CODES.map(
    (c) => `  ${c.code} (${c.unit}) — ${c.description}`
  ).join("\n");

  // Recursive self-learning: pull recent rejected/edited estimates so Ledger
  // learns from prior corrections without retraining.
  const preamble = await feedbackPreamble("ledger", "estimate_draft", 5);

  // Anchor unit prices to the reviewed price book whenever the code is in it.
  // When the book is empty (early days) this returns "" and the model falls
  // back to its prior behavior — no behavior change for unseeded users.
  const priceBookBlock = formatPriceBookForPrompt(priceBook);

  const message = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: 4096,
    tools: [ESTIMATE_TOOL],
    tool_choice: { type: "tool", name: "generate_water_mitigation_estimate" },
    ...({ _agent: "ledger", _task: "estimate_draft" } as any),
    messages: [
      {
        role: "user",
        content: preamble + `You are Ledger, the AI estimator for First Call Mitigation in Austin TX.

Generate a complete Xactimate-style estimate from the scope below. Every line item the carrier would expect to see — extraction, equipment setup/removal, daily drying, demolition (flood cuts, baseboards, insulation removal), antimicrobial, cleaning.

PRICING RULES (read carefully):
1. If a Xactimate code appears in the PRICE BOOK below, use that unit_price EXACTLY. Do not adjust it. The book is the reviewed ground truth.
2. Only invent unit_price for codes NOT in the book — use realistic 2026 Austin TX market rates and call it out in 'assumptions' so the estimator knows to verify.
3. Prefer codes that are in the book over codes that aren't, when both are reasonable choices for the work.

GOAL: produce an estimate the office can review in 5 minutes and send. Don't overlook things ("missing items" cost us money). Don't pad either ("padded estimates" get pushback from adjusters).

REFERENCE — common Xactimate codes (descriptions only; prices come from the price book if present):
${codeReference}

${priceBookBlock || "PRICE BOOK: (empty — no anchored prices yet; flag your invented prices in 'assumptions')"}

JOB CONTEXT:
${jobContext}

ARGUS SCOPE:
${JSON.stringify(scope, null, 2)}

Now generate the estimate. Be thorough but realistic.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Ledger estimate generation failed.");
  }
  return toolUse.input as EstimateOutput;
}
