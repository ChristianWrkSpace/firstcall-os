// Per-model token pricing in USD per million tokens. Update when Anthropic
// publishes new prices. Models prefixed with "anthropic/" (gateway routing)
// fall through to the unprefixed match.

interface ModelPricing {
  inPerM: number;   // USD per 1M input tokens
  outPerM: number;  // USD per 1M output tokens
}

const PRICING: Record<string, ModelPricing> = {
  // Anthropic — direct + gateway-prefixed
  "claude-opus-4-7":     { inPerM: 5,    outPerM: 25 },
  "claude-opus-4-6":     { inPerM: 5,    outPerM: 25 },
  "claude-sonnet-4-6":   { inPerM: 3,    outPerM: 15 },
  "claude-haiku-4-5":    { inPerM: 1,    outPerM: 5  },
  // Common cross-provider tiers (when AI Gateway is on)
  "openai/gpt-4o-mini":      { inPerM: 0.15, outPerM: 0.6 },
  "openai/gpt-4o":           { inPerM: 2.5,  outPerM: 10 },
  "google/gemini-2.0-flash": { inPerM: 0.075, outPerM: 0.30 },
  "deepseek/deepseek-v3":    { inPerM: 0.14,  outPerM: 0.28 },
};

function normalizeModel(model: string): string {
  // Strip provider prefix when present so "anthropic/claude-opus-4-7" → "claude-opus-4-7"
  const slash = model.indexOf("/");
  if (slash === -1) return model;
  const after = model.slice(slash + 1);
  // Only strip if the stripped form is in our table
  if (PRICING[after]) return after;
  return model;
}

export function priceCall(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const key = normalizeModel(model);
  const p = PRICING[key];
  if (!p) return 0;
  const inCost = (tokensIn / 1_000_000) * p.inPerM;
  const outCost = (tokensOut / 1_000_000) * p.outPerM;
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
}

export function tierFor(model: string): "fast" | "balanced" | "smart" | "unknown" {
  const k = normalizeModel(model);
  if (k.includes("haiku") || k.includes("flash") || k.includes("mini")) return "fast";
  if (k.includes("sonnet") || k.includes("deepseek-v3") || k === "openai/gpt-4o") return "balanced";
  if (k.includes("opus")) return "smart";
  return "unknown";
}
