import { anthropic, MODELS } from "./ai";
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

  const message = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 4096,
    tools: [SCOPE_TOOL],
    tool_choice: { type: "tool", name: "assess_damage_scope" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are Argus, the AI scoping engineer for First Call Mitigation. Assess the following site photos following IICRC S500 (water) / S520 (mold) standards.

Your job: produce a TIGHT equipment list the tech will load on the truck. Don't overload (waste) and don't underload (return trips). Show your math in the calculations field so the tech can verify before rolling.

Be honest about confidence — if the photos don't show enough, say so in additional_photos_needed.

Job context:
${jobContext}${dispatcherInputBlock}

Now analyze every photo and produce the structured scope.`,
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
