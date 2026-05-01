import Anthropic from "@anthropic-ai/sdk";

/**
 * AI plumbing for FirstCall OS — model-agnostic via Vercel AI Gateway.
 *
 * Routing:
 *   - If AI_GATEWAY_API_KEY is set → route through Vercel AI Gateway
 *     (model-agnostic, observability, fallbacks, zero-data-retention).
 *   - Else → direct Anthropic API.
 *
 * Either way, every existing call site keeps working without code changes
 * because we still expose the Anthropic SDK shape.
 *
 * Model tiers — ALWAYS import MODELS.* instead of hardcoding strings.
 * That way, when the right tradeoff for a task changes, we flip ONE constant.
 */

const GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Vercel AI Gateway's Anthropic-compatible endpoint. The gateway proxies the
// Anthropic API surface so the SDK can talk to it unchanged.
const GATEWAY_ANTHROPIC_BASE = "https://ai-gateway.vercel.sh/v1/anthropic";

export const anthropic = new Anthropic({
  apiKey: GATEWAY_KEY ?? ANTHROPIC_KEY,
  ...(GATEWAY_KEY ? { baseURL: GATEWAY_ANTHROPIC_BASE } : {}),
});

export const AI_PROVIDER: "gateway" | "direct" = GATEWAY_KEY ? "gateway" : "direct";

/**
 * Tiered models. Pick by what the task actually needs.
 *
 * FAST (Haiku 4.5) — classification, parsing, lead research, light extraction.
 *   Cheap + fast. Use whenever a precise schema is enforced and the task is
 *   not multi-hop.
 *
 * BALANCED (Sonnet 4.6) — drafts that a human reviews (estimates, legal docs,
 *   adjuster outreach). Good reasoning at moderate cost. Default for "agent
 *   produces a draft, person approves."
 *
 * SMART (Opus 4.7) — vision-heavy scope analysis (Argus), chat/orchestration
 *   (Solomon), anything where wrong answers are expensive.
 */
export const MODELS = {
  FAST: "claude-haiku-4-5",
  BALANCED: "claude-sonnet-4-6",
  SMART: "claude-opus-4-7",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * Pick a model by intent without thinking about provider strings:
 *   modelFor("fast") → "claude-haiku-4-5"
 */
export function modelFor(tier: Lowercase<ModelTier> | ModelTier): string {
  const upper = tier.toUpperCase() as ModelTier;
  return MODELS[upper];
}
