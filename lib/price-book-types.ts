// Client-safe types/constants for the unit price book. Server-only logic
// (Supabase reads/writes, Anthropic prompts) lives in lib/price-book.ts.

export type PricingSource = "book" | "guessed";

export interface PriceBookEntry {
  xactimate_code: string;
  description: string;
  unit: string;
  unit_price: number;
  source: "manual" | "seeded" | "learned";
  sample_size: number;
  notes: string | null;
  last_updated: string;
}

export const PRICING_SOURCE_LABEL: Record<PricingSource, string> = {
  book: "Book",
  guessed: "AI guess",
};
