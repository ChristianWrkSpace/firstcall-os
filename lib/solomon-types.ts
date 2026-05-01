// Solomon — FP&A & Margin Analysis (client-safe types)
// NO Anthropic / NO supabase-server imports here.

export type SeverityLevel = "info" | "watch" | "alert";

export interface SolomonInsight {
  category: "revenue" | "carrier" | "geography" | "type" | "operations" | "pricing";
  severity: SeverityLevel;
  headline: string; // 1 sentence
  detail: string; // 1-3 sentences explaining why
  metric: string; // e.g. "$2,840 avg ticket vs $4,120 baseline"
  evidence?: string[]; // bullet list of supporting data points
}

export interface SolomonRecommendation {
  priority: "now" | "next_quarter" | "watch";
  action: string; // imperative, e.g. "Raise demo pricing 8% in 78704"
  rationale: string; // 1-2 sentences
  estimated_impact_dollars?: number;
}

export interface SolomonAnalysisResult {
  summary: string; // 2-3 sentence executive summary
  insights: SolomonInsight[];
  recommendations: SolomonRecommendation[];
}

export const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  info:  "bg-zinc-700 text-zinc-300",
  watch: "bg-yellow-500/15 text-yellow-300",
  alert: "bg-red-500/15 text-red-400",
};

export const PRIORITY_BADGE: Record<SolomonRecommendation["priority"], string> = {
  now:           "bg-red-500/15 text-red-400",
  next_quarter:  "bg-blue-500/15 text-blue-400",
  watch:         "bg-zinc-700 text-zinc-300",
};

export const CATEGORY_LABEL: Record<SolomonInsight["category"], string> = {
  revenue:    "Revenue",
  carrier:    "Carrier",
  geography:  "Geography",
  type:       "Job Type",
  operations: "Operations",
  pricing:    "Pricing",
};
