/**
 * Seed (or re-seed) the unit_price_book table from a CSV.
 *
 * Usage:
 *   npx tsx scripts/seed-price-book.ts ./price-book-seed.csv
 *
 * CSV columns (header row required, order doesn't matter):
 *   code,description,unit,unit_price,notes
 *
 * Each row upserts into unit_price_book with source='seeded' and
 * last_updated=now(). Re-running overwrites existing rows so you can keep
 * the CSV as the source of truth and re-seed when prices change. Manual
 * edits made directly to the table after seeding will be preserved only
 * if you remove the row from the CSV before re-running.
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npx tsx scripts/seed-price-book.ts <path-to-csv>");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedRow {
  xactimate_code: string;
  description: string;
  unit: string;
  unit_price: number;
  notes: string | null;
}

// Tiny RFC-4180-ish CSV parser. Handles quoted fields (with embedded commas
// and double-quote escapes) but keeps the impl small — no streaming, no
// dialect detection. Good enough for a hand-curated price book CSV.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (field !== "" || row.length > 0) {
          row.push(field);
          rows.push(row);
        }
        row = [];
        field = "";
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsv(path: string): SeedRow[] {
  const raw = readFileSync(resolve(path), "utf8");
  const rows = parseCsv(raw);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const codeIdx = idx("code");
  const descIdx = idx("description");
  const unitIdx = idx("unit");
  const priceIdx = idx("unit_price");
  const notesIdx = idx("notes");

  if (codeIdx < 0 || descIdx < 0 || unitIdx < 0 || priceIdx < 0) {
    throw new Error(
      "CSV must include columns: code, description, unit, unit_price (notes optional)"
    );
  }

  const out: SeedRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const code = cells[codeIdx]?.trim();
    if (!code) continue; // skip blank rows
    const priceRaw = (cells[priceIdx] ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Row ${r + 1}: invalid unit_price "${cells[priceIdx]}" for code ${code}`);
    }
    out.push({
      xactimate_code: code,
      description: (cells[descIdx] ?? "").trim(),
      unit: (cells[unitIdx] ?? "").trim().toUpperCase(),
      unit_price: price,
      notes: notesIdx >= 0 ? (cells[notesIdx] ?? "").trim() || null : null,
    });
  }
  return out;
}

async function main() {
  console.log(`Reading ${csvPath}…`);
  const seedRows = readCsv(csvPath);
  console.log(`Parsed ${seedRows.length} rows.`);

  if (seedRows.length === 0) {
    console.log("Nothing to seed. Exiting.");
    return;
  }

  const upsertPayload = seedRows.map((r) => ({
    xactimate_code: r.xactimate_code,
    description: r.description,
    unit: r.unit,
    unit_price: r.unit_price,
    notes: r.notes,
    source: "seeded" as const,
    sample_size: 0,
    last_updated: new Date().toISOString(),
  }));

  const { data, error } = await admin
    .from("unit_price_book")
    .upsert(upsertPayload, { onConflict: "xactimate_code" })
    .select("xactimate_code");

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Upserted ${data?.length ?? 0} rows into unit_price_book.`);
  console.log(`  Visit /settings/price-book to verify.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
