// Xactimate-style CSV export for restoration estimates.
//
// IMPORTANT — honesty check: this is NOT a direct Xactimate (.esx / .esxi)
// import file. Verisk gates that format behind a vendor relationship which
// we don't have. What this DOES produce is a structured CSV with the columns
// adjusters and field estimators recognize from Xactimate, so they can:
//
//   1. Visually review the estimate in spreadsheet form
//   2. Manually re-key into Xactimate if their workflow requires it
//   3. Hand to a desk adjuster for fast eyeball-comparison
//
// Once we have a Verisk vendor agreement, swap this for real .esx XML output.

export interface XactimateLineRow {
  category: string | null;
  selector_code: string | null; // e.g. "WTR EXTB", "WTR DEHU-LR"
  description: string;
  quantity: number;
  unit: string;            // SF, LF, EA, HR, DA
  unit_price: number;
  line_total: number;
  notes: string | null;
}

export interface XactimateExportInput {
  job_number: string;
  job_type: string | null;
  customer_name: string | null;
  loss_address: string | null;
  carrier: string | null;
  claim_number: string | null;
  policy_number: string | null;
  estimate_version: number;
  estimate_status: string;
  generated_at: string | null;
  approved_at: string | null;
  lines: XactimateLineRow[];
}

// RFC 4180 CSV escape: wrap in quotes if the field contains comma / quote /
// newline; double-up any embedded quotes.
function csvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(...fields: Array<string | number | null | undefined>): string {
  return fields.map(csvField).join(",");
}

export function estimateToXactimateCsv(input: XactimateExportInput): string {
  const lines: string[] = [];

  // Header block — adjuster-facing context. Xactimate's own export does this
  // as a multi-line preamble before the line-item table; we mirror that so a
  // desk reviewer sees what they expect.
  lines.push(row("# FirstCall Mitigation — Xactimate-Style Estimate Export"));
  lines.push(row("# Job number", input.job_number));
  lines.push(row("# Job type", input.job_type));
  lines.push(row("# Customer", input.customer_name));
  lines.push(row("# Loss address", input.loss_address));
  lines.push(row("# Carrier", input.carrier));
  lines.push(row("# Claim #", input.claim_number));
  lines.push(row("# Policy #", input.policy_number));
  lines.push(row("# Estimate version", input.estimate_version));
  lines.push(row("# Status", input.estimate_status));
  lines.push(row("# Generated", input.generated_at));
  lines.push(row("# Approved", input.approved_at));
  lines.push("");

  // Column headers — Xactimate's typical line-item shape.
  lines.push(
    row(
      "Category",
      "Selector",
      "Description",
      "Quantity",
      "Unit",
      "Unit Price",
      "Line Total",
      "Notes"
    )
  );

  let runningTotal = 0;
  for (const li of input.lines) {
    runningTotal += li.line_total;
    lines.push(
      row(
        li.category,
        li.selector_code,
        li.description,
        li.quantity.toFixed(2),
        li.unit,
        li.unit_price.toFixed(2),
        li.line_total.toFixed(2),
        li.notes
      )
    );
  }

  // Total row
  lines.push("");
  lines.push(row("", "", "", "", "", "RCV Subtotal", runningTotal.toFixed(2), ""));

  return lines.join("\r\n") + "\r\n";
}
