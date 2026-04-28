// Email templates for Abacus AR. Plain branded HTML — no third-party render lib.

interface LineItemForEmail {
  category?: string | null;
  xactimate_code?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

interface InvoiceContext {
  invoice_number: string;
  job_number: string;
  customer_name: string;
  insurance_company?: string | null;
  claim_number?: string | null;
  loss_address?: string | null;
  total: number;
  due_date?: string | null;
  days_outstanding?: number;
  invoice_url?: string;
  line_items?: LineItemForEmail[];
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function shell(body: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 16px 28px;border-bottom:2px solid #18181b;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:18px;font-weight:bold;color:#18181b;">First Call Mitigation</td>
              <td align="right" style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Water · Fire · Mold</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 28px;">${body}</td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;background:#fafafa;font-size:11px;color:#71717a;">
          First Call Mitigation · Austin, Texas · IICRC Certified · 24/7 Emergency Response
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderLineItemsTable(items: LineItemForEmail[]) {
  if (items.length === 0) return "";

  // Group by category in the same order as the print invoice
  const order = [
    "Water Extraction",
    "Equipment Setup",
    "Daily Drying",
    "Demolition",
    "Cleaning & Antimicrobial",
    "Containment",
    "Other",
  ];
  const byCat: Record<string, LineItemForEmail[]> = {};
  for (const li of items) {
    const cat = li.category ?? "Other";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(li);
  }
  const cats = order.filter((c) => byCat[c]?.length > 0);

  const rows = cats
    .map((cat) => {
      const subtotal = byCat[cat].reduce(
        (s, li) => s + Number(li.line_total ?? 0),
        0
      );
      const itemRows = byCat[cat]
        .map(
          (li) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-family:Menlo,monospace;font-size:11px;color:#52525b;vertical-align:top;">${li.xactimate_code ?? "—"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-size:12px;vertical-align:top;">${li.description}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-family:Menlo,monospace;font-size:11px;text-align:right;vertical-align:top;">${Number(li.quantity).toFixed(2)} ${li.unit}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-family:Menlo,monospace;font-size:11px;text-align:right;vertical-align:top;">${fmt(Number(li.unit_price))}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;font-family:Menlo,monospace;font-size:12px;font-weight:600;text-align:right;vertical-align:top;">${fmt(Number(li.line_total))}</td>
            </tr>`
        )
        .join("");

      return `
        <tr>
          <td colspan="5" style="padding:10px 8px 4px 8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;color:#1e3a8a;background:#f4f4f5;border-top:1px solid #d4d4d8;border-bottom:1px solid #d4d4d8;">${cat}</td>
        </tr>
        ${itemRows}
        <tr>
          <td colspan="4" style="padding:6px 8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;color:#52525b;border-bottom:2px solid #a1a1aa;">${cat} subtotal</td>
          <td style="padding:6px 8px;text-align:right;font-family:Menlo,monospace;font-size:13px;font-weight:bold;border-bottom:2px solid #a1a1aa;">${fmt(subtotal)}</td>
        </tr>`;
    })
    .join("");

  return `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0 0 0;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid #18181b;">
          <th style="padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#52525b;text-align:left;width:70px;">Code</th>
          <th style="padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#52525b;text-align:left;">Description</th>
          <th style="padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#52525b;text-align:right;width:80px;">Qty</th>
          <th style="padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#52525b;text-align:right;width:80px;">Unit Price</th>
          <th style="padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#52525b;text-align:right;width:90px;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildInvoiceEmail(ctx: InvoiceContext) {
  const subject = `Invoice ${ctx.invoice_number} — ${ctx.customer_name} loss${ctx.claim_number ? ` (Claim ${ctx.claim_number})` : ""}`;

  const itemsTable = ctx.line_items?.length ? renderLineItemsTable(ctx.line_items) : "";

  const html = shell(`
    <h2 style="margin:0 0 16px 0;font-size:20px;">Invoice ${ctx.invoice_number}</h2>
    <p style="margin:0 0 12px 0;line-height:1.5;">
      Please find below the itemized invoice for water mitigation services performed at the loss location referenced.
    </p>

    <table cellpadding="6" cellspacing="0" style="margin:16px 0;font-size:13px;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;width:100%;">
      <tr><td style="color:#71717a;width:130px;">Insured</td><td style="font-weight:600;">${ctx.customer_name}</td></tr>
      <tr><td style="color:#71717a;">Loss Address</td><td>${ctx.loss_address ?? "—"}</td></tr>
      ${ctx.insurance_company ? `<tr><td style="color:#71717a;">Carrier</td><td>${ctx.insurance_company}</td></tr>` : ""}
      ${ctx.claim_number ? `<tr><td style="color:#71717a;">Claim #</td><td style="font-family:Menlo,monospace;">${ctx.claim_number}</td></tr>` : ""}
      <tr><td style="color:#71717a;">Job #</td><td style="font-family:Menlo,monospace;">${ctx.job_number}</td></tr>
      ${ctx.due_date ? `<tr><td style="color:#71717a;">Due Date</td><td>${ctx.due_date}</td></tr>` : ""}
    </table>

    ${itemsTable}

    <div style="background:#18181b;color:#fff;padding:16px 20px;border-radius:6px;margin:20px 0;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Total Due</div>
      <div style="font-size:28px;font-weight:bold;font-family:Menlo,monospace;margin-top:4px;">${fmt(ctx.total)}</div>
    </div>

    <p style="margin:0 0 12px 0;line-height:1.5;font-size:13px;">
      Please remit payment per the terms of the Assignment of Benefits / direction of payment on file.
      Net 30 from invoice date. Per Tex. Ins. Code § 542.058, prompt-pay obligations apply to
      first-party claims.
    </p>
    <p style="margin:0;line-height:1.5;color:#71717a;font-size:12px;">
      Questions? Reply to this email and our office will respond within one business day.
    </p>
  `);

  return { subject, html };
}

export function buildReminderEmail(
  ctx: InvoiceContext,
  type: "gentle" | "firm" | "final"
) {
  const tones = {
    gentle: {
      subject: `Friendly reminder — Invoice ${ctx.invoice_number} (${ctx.days_outstanding ?? "?"} days out)`,
      lead: `This is a friendly follow-up on the invoice referenced below. Please confirm receipt and let us know if anything additional is needed for processing.`,
      cta: `Appreciate you taking a look — happy to walk through any line items if helpful.`,
    },
    firm: {
      subject: `Past due — Invoice ${ctx.invoice_number} (${ctx.days_outstanding ?? "?"} days outstanding)`,
      lead: `Our records show this invoice is now past due. Please advise on the status of payment or any outstanding documentation needs.`,
      cta: `If there's a hold on processing, please reply with what we can provide to move it forward.`,
    },
    final: {
      subject: `FINAL NOTICE — Invoice ${ctx.invoice_number}`,
      lead: `This is a final notice regarding the invoice below. Per Tex. Ins. Code § 542.058, prompt-pay obligations apply to first-party claims. We may be required to escalate this matter if payment is not received or a status update provided.`,
      cta: `Please respond within 5 business days to avoid further action.`,
    },
  };
  const t = tones[type];

  const html = shell(`
    <h2 style="margin:0 0 16px 0;font-size:20px;">${type === "final" ? "Final Notice" : "Payment Reminder"}</h2>
    <p style="margin:0 0 12px 0;line-height:1.5;">${t.lead}</p>

    <table cellpadding="6" cellspacing="0" style="margin:16px 0;font-size:13px;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;">
      <tr><td style="color:#71717a;">Invoice #</td><td style="font-family:Menlo,monospace;">${ctx.invoice_number}</td></tr>
      <tr><td style="color:#71717a;">Insured</td><td style="font-weight:600;">${ctx.customer_name}</td></tr>
      ${ctx.claim_number ? `<tr><td style="color:#71717a;">Claim #</td><td style="font-family:Menlo,monospace;">${ctx.claim_number}</td></tr>` : ""}
      <tr><td style="color:#71717a;">Job #</td><td style="font-family:Menlo,monospace;">${ctx.job_number}</td></tr>
      ${ctx.days_outstanding !== undefined ? `<tr><td style="color:#71717a;">Days Outstanding</td><td style="${type === "final" ? "color:#dc2626;font-weight:bold;" : ""}">${ctx.days_outstanding}</td></tr>` : ""}
    </table>

    <div style="background:${type === "final" ? "#7f1d1d" : "#18181b"};color:#fff;padding:16px 20px;border-radius:6px;margin:20px 0;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#fecaca;">Balance Due</div>
      <div style="font-size:28px;font-weight:bold;font-family:Menlo,monospace;margin-top:4px;">${fmt(ctx.total)}</div>
    </div>

    <p style="margin:0;line-height:1.5;">${t.cta}</p>
  `);

  return { subject: t.subject, html };
}
