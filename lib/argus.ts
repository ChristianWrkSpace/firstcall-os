import { anthropic, MODELS } from "./ai";
import { feedbackPreamble } from "./agent-feedback";
import type Anthropic from "@anthropic-ai/sdk";

export const SCOPE_TOOL: Anthropic.Tool = {
  name: "assess_damage_scope",
  description:
    "Assess water/fire/mold damage from site photos following IICRC S500/S520 standards. Output the structured scope a mitigation tech and estimator need to dispatch with the right equipment.",
  input_schema: {
    type: "object",
    properties: {
      water_category: {
        type: "string",
        enum: ["1", "2", "3", "n/a"],
        description:
          "IICRC S500: 1=clean (sanitary water), 2=gray (some contamination, e.g., washing machine), 3=black (grossly contaminated, sewage/floodwater). n/a if not water damage.",
      },
      water_class: {
        type: "string",
        enum: ["1", "2", "3", "4", "n/a"],
        description:
          "IICRC S500: 1=minimal saturation (part of room), 2=significant absorption (full room <24'), 3=ceiling+walls+floor saturated, 4=specialty drying (stone/hardwood/concrete). n/a if not water.",
      },
      affected_areas: {
        type: "array",
        description: "List every distinct affected area visible in the photos.",
        items: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "e.g., 'Kitchen floor', 'Master bedroom ceiling', 'Hallway carpet'",
            },
            materials: {
              type: "array",
              items: { type: "string" },
              description:
                "Affected materials: drywall, hardwood, carpet/pad, tile, subfloor, insulation, cabinetry, baseboards, etc.",
            },
            estimated_sqft: {
              type: "number",
              description: "Best-effort estimate of affected square footage in this area.",
            },
            severity: { type: "string", enum: ["minor", "moderate", "severe"] },
            notes: { type: "string" },
          },
          required: ["location", "materials", "severity"],
        },
      },
      equipment_needed: {
        type: "object",
        description: "Recommended equipment to dispatch based on affected sqft and IICRC drying calculations.",
        properties: {
          lgr_dehumidifiers: { type: "number", description: "Low Grain Refrigerant dehus needed" },
          conventional_dehumidifiers: { type: "number" },
          air_movers: { type: "number", description: "1 per 50-70 sqft of affected floor" },
          air_scrubbers: { type: "number", description: "Required for cat 3, recommended for cat 2 with porous materials" },
          other: { type: "array", items: { type: "string" }, description: "e.g., 'extraction pump', 'containment poly'" },
        },
        required: ["lgr_dehumidifiers", "air_movers"],
      },
      safety_concerns: {
        type: "array",
        items: { type: "string" },
        description: "Slip hazards, electrical exposure, mold risk, asbestos suspicion, structural compromise, etc.",
      },
      ppe_required: {
        type: "array",
        items: { type: "string" },
        description: "e.g., 'N95', 'Tyvek suit', 'rubber boots', 'face shield'",
      },
      estimated_dry_days: {
        type: "number",
        description: "Realistic drying time per IICRC standards (typically 3-5 days for cat 1/2).",
      },
      mitigation_steps: {
        type: "array",
        items: { type: "string" },
        description: "High-level work plan: extraction, demolition (cuts), antimicrobial, drying setup, monitoring.",
      },
      containment_plan: {
        type: "array",
        description:
          "Where to install poly containment / decon chambers / negative-air zones, in setup order. Be specific about geometry — wall-to-wall, ceiling-to-floor, doorway, etc.",
        items: {
          type: "object",
          properties: {
            area: {
              type: "string",
              description: "Specific location, e.g. 'Bathroom doorway, ceiling-to-floor critical barrier'",
            },
            type: {
              type: "string",
              enum: [
                "full_critical_barrier",
                "partial_barrier",
                "decon_chamber",
                "negative_air_zone",
                "splash_guard",
              ],
            },
            reason: {
              type: "string",
              description: "Why here — e.g. 'isolate active mold growth from kitchen during demo'",
            },
          },
          required: ["area", "type", "reason"],
        },
      },
      tech_playbook: {
        type: "array",
        items: { type: "string" },
        description:
          "Step-by-step instructions for the tech, ordered. 8–12 steps max. Each step is concrete and actionable: 'Don PPE before entering containment', 'Set up zipper door at bathroom entry', 'Place LGR1 in bathroom under negative pressure', etc. This is what the tech reads on the truck before walking in.",
      },
      summary: {
        type: "string",
        description: "One-paragraph executive summary the tech reads on arrival.",
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "How confident in this assessment based on photo quality and coverage.",
      },
      additional_photos_needed: {
        type: "string",
        description: "What other angles, areas, or close-ups would improve the assessment?",
      },
      calculations: {
        type: "object",
        description:
          "Show your math so the tech can verify before loading the truck. Use the dispatcher inputs (ceiling height, property type) — do NOT guess if values were provided.",
        properties: {
          ceiling_height_ft_used: { type: "number" },
          total_affected_sqft: { type: "number" },
          affected_volume_cuft: { type: "number" },
          air_mover_math: {
            type: "string",
            description:
              "Human-readable formula, e.g. '12 air movers = ceil(635 sqft wet floor / 50 sqft per AM) + ceil(40 LF wet wall / 12 LF per AM)'",
          },
          dehumidifier_math: {
            type: "string",
            description:
              "Show the AHAM pints calculation, e.g. '5,080 cu ft / 40 (Class 3 factor) = 127 pints/24hr needed → 1 LGR (130 pints) × 1.5 safety = 2 LGRs (rounded to 3 for fast recovery)'",
          },
          air_scrubber_math: { type: "string" },
          safety_factor_applied: {
            type: "string",
            description:
              "What buffer did you add and why? e.g. '1.5× on dehus for fast recovery on Cat 2 with mold present'",
          },
          key_assumptions: {
            type: "array",
            items: { type: "string" },
            description:
              "Every assumption you made that the tech should verify on arrival, e.g. 'ceiling height 8ft assumed', 'kitchen sqft estimated from caller report'.",
          },
        },
        required: ["air_mover_math", "dehumidifier_math", "key_assumptions"],
      },
    },
    required: ["affected_areas", "equipment_needed", "summary", "confidence", "calculations"],
  },
};

export interface ScopeImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  data: string; // base64
}

export interface DispatchInputs {
  ceiling_height_ft?: number;
  property_type?: "residential" | "commercial" | "multi_family";
  year_built?: number | string;
  stories?: number;
  water_source_secured?: boolean;
  access_notes?: string;
}

export async function assessScope(
  images: ScopeImage[],
  jobContext: string,
  inputs: DispatchInputs = {}
) {
  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));

  const inputLines: string[] = [];
  if (inputs.ceiling_height_ft) inputLines.push(`Ceiling height: ${inputs.ceiling_height_ft} ft (USE THIS — do not guess)`);
  if (inputs.property_type) inputLines.push(`Property type: ${inputs.property_type}`);
  if (inputs.year_built) inputLines.push(`Year built / age: ${inputs.year_built} (factor in lead/asbestos risk if pre-1980)`);
  if (inputs.stories) inputLines.push(`Stories: ${inputs.stories}`);
  if (inputs.water_source_secured !== undefined)
    inputLines.push(`Water source secured: ${inputs.water_source_secured ? "yes" : "NO — water still flowing"}`);
  if (inputs.access_notes) inputLines.push(`Access / site notes: ${inputs.access_notes}`);

  const dispatcherInputBlock = inputLines.length
    ? `\n\nDISPATCHER INPUTS (use these directly, don't guess):\n${inputLines.join("\n")}`
    : `\n\n(No dispatcher inputs provided — note your assumptions in calculations.key_assumptions)`;

  // Recursive self-learning: pull recent corrections to past scopes so Argus
  // doesn't repeat mistakes (over/under-loading, missed assumptions, etc).
  const preamble = await feedbackPreamble("argus", "scope_assessment", 5);

  const message = await anthropic.messages.create({
    // Sonnet (BALANCED) — vision quality is excellent for scope work and
    // it's 2-3x faster than Opus on multi-image inputs. Forced tool_use
    // keeps the structured output exactly as before. Bump to SMART later
    // if scope quality regressions show up in agent_outcomes.
    model: MODELS.BALANCED,
    max_tokens: 3000,
    tools: [SCOPE_TOOL],
    tool_choice: { type: "tool", name: "assess_damage_scope" },
    // Vision calls take 30-60s on multi-image inputs. Give the first attempt
    // 150s and allow exactly one retry — default would be 60s × 3 = 180s
    // worst-case wait but every attempt timing out at 60s on a real workload.
    ...({ _agent: "argus", _task: "scope_assessment", _timeout_ms: 150_000, _max_retries: 1 } as any),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: preamble + `You are Argus, the AI scoping engineer for First Call Mitigation. Assess the following site photos (some may be frames extracted from a walk-through video) following IICRC S500 (water) / S520 (mold) standards.

Your job — three deliverables in one pass:

1. TIGHT EQUIPMENT LIST the tech loads on the truck. Don't overload (waste) and don't underload (return trips). Show your math in the calculations field so the tech can verify before rolling.

2. CONTAINMENT PLAN — where to install poly, decon chambers, negative-air zones, splash guards, and IN WHAT ORDER. Be specific about geometry (wall-to-wall, ceiling-to-floor, doorway, transition between rooms). The tech reads this and walks straight in knowing where to tape.

3. TECH PLAYBOOK — the step-by-step the tech follows from arrival to first reading. 8–12 concrete actions ordered chronologically. Includes PPE donning, source verification, containment install, equipment placement, first moisture readings, photos to take. This is the dummy-proof checklist.

Be honest about confidence — if the photos/frames don't show enough, say so in additional_photos_needed.

Job context:
${jobContext}${dispatcherInputBlock}

Now analyze every frame/photo and produce the full structured scope.`,
          },
          ...imageBlocks,
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Argus assessment failed — no tool output.");
  }
  return toolUse.input;
}

/**
 * Merge N partial scope assessments (each from a different batch of
 * photos on the same job) into one unified scope. Used by deep-scan
 * mode after running Argus in parallel on chunks. Single text-only
 * Sonnet call, no images.
 *
 * Strategy: feed Argus the partials as JSON and ask it to produce one
 * unified scope using the same tool schema. The model handles
 * deduplication of affected_areas, takes the MAX of equipment counts
 * (no undercounting), unions containment_plan zones, picks the most
 * comprehensive tech_playbook, and writes one cohesive summary.
 */
export async function synthesizeScopes(
  partialScopes: any[],
  jobContext: string
): Promise<any> {
  if (partialScopes.length === 0) {
    throw new Error("synthesizeScopes called with no partials");
  }
  if (partialScopes.length === 1) return partialScopes[0];

  const message = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: 3500,
    tools: [SCOPE_TOOL],
    tool_choice: { type: "tool", name: "assess_damage_scope" },
    ...({ _agent: "argus", _task: "scope_synthesis", _timeout_ms: 120_000, _max_retries: 1 } as any),
    messages: [
      {
        role: "user",
        content: `You are Argus. ${partialScopes.length} partial scope assessments below were generated from different photo batches of the SAME job. Merge them into ONE unified scope using the same tool.

Rules when merging:
- AFFECTED AREAS: dedupe by location. Same room mentioned twice = one entry, with the most thorough materials list and notes.
- EQUIPMENT NEEDED: take the MAX of each count across partials (never undercount). Sum the 'other' lists with dedup.
- CONTAINMENT PLAN: union all unique zones. If the same area appears twice, keep the more specific entry.
- TECH PLAYBOOK: produce ONE coherent ordered playbook (not concatenated). 8-12 steps total.
- MITIGATION STEPS: same — one coherent ordered list.
- CONFIDENCE: take the LOWEST confidence across partials (honest aggregation).
- CALCULATIONS: redo the math against the unified equipment counts and total sqft. Show your work.
- SUMMARY: one cohesive paragraph reflecting the full job, not a list of partial summaries.
- ADDITIONAL_PHOTOS_NEEDED: union of all gaps, deduped.

Job context:
${jobContext}

Partial scopes (JSON):
${JSON.stringify(partialScopes, null, 2)}

Now produce the unified scope via the assess_damage_scope tool.`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Synthesis failed — no tool output.");
  }
  return toolUse.input;
}
