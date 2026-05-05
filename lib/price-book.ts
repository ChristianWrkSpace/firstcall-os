import { createAdminClient } from "./supabase-server";
import type { PriceBookEntry } from "./price-book-types";

/**
 * Load the entire unit price book as a Map keyed by Xactimate code.
 * Small table (tens-to-low-hundreds of rows). Read fully on every estimate
 * draft — no caching layer here so manual edits are visible immediately.
 */
export async function loadPriceBook(): Promise<Map<string, PriceBookEntry>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("unit_price_book")
    .select(
      "xactimate_code, description, unit, unit_price, source, sample_size, notes, last_updated"
    );
  if (error) {
    console.error("[price-book] load failed:", error.message);
    return new Map();
  }
  const map = new Map<string, PriceBookEntry>();
  for (const row of (data ?? []) as PriceBookEntry[]) {
    map.set(row.xactimate_code, row);
  }
  return map;
}

/**
 * Format the price book as a compact table for prompt injection. Only codes
 * with non-zero unit_price are useful as anchors. Returned string is empty
 * when the book is empty so the prompt cleanly degrades to old behavior.
 */
export function formatPriceBookForPrompt(book: Map<string, PriceBookEntry>): string {
  if (book.size === 0) return "";
  const rows = [...book.values()]
    .filter((r) => r.unit_price > 0)
    .sort((a, b) => a.xactimate_code.localeCompare(b.xactimate_code))
    .map(
      (r) =>
        `  ${r.xactimate_code} | ${r.unit} | $${r.unit_price.toFixed(2)} | ${r.description}`
    );
  if (rows.length === 0) return "";
  return [
    "PRICE BOOK (authoritative — use these unit_price values verbatim when the code matches):",
    "  code | unit | unit_price | description",
    ...rows,
  ].join("\n");
}
