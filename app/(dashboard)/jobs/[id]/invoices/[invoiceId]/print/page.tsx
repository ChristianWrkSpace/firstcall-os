import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintTrigger from "./PrintTrigger";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id: jobId, invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: invoice }, { data: lineItems }, { data: payments }, { data: job }] =
    await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoiceId).single(),
      supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true }),
      supabase.from("payments").select("amount").eq("invoice_id", invoiceId),
      supabase
        .from("jobs")
        .select("*, customers(*)")
        .eq("id", jobId)
        .single(),
    ]);

  if (!invoice || !job) notFound();

  const customer = (job as any).customers ?? {};
  const items = lineItems ?? [];
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const byCategory: Record<string, any[]> = {};
  for (const li of items) {
    const cat = li.category ?? "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(li);
  }
  const categoryOrder = [
    "Water Extraction",
    "Equipment Setup",
    "Daily Drying",
    "Demolition",
    "Cleaning & Antimicrobial",
    "Containment",
    "Other",
  ];
  const categories = categoryOrder.filter((c) => byCategory[c]?.length > 0);

  const subtotalsByCategory: Record<string, number> = {};
  let grandTotal = 0;
  for (const cat of categories) {
    const subtotal = byCategory[cat].reduce(
      (sum, li) => sum + Number(li.line_total ?? 0),
      0
    );
    subtotalsByCategory[cat] = subtotal;
    grandTotal += subtotal;
  }

  const balance = grandTotal - totalPaid;

  const issueDate = new Date(invoice.issue_date ?? invoice.created_at);
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateFmt = (d: Date) =>
    d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="print-page bg-white text-black min-h-screen">
      <PrintTrigger />

      <div className="no-print bg-zinc-100 border-b border-zinc-300 px-6 py-3 flex items-center justify-between">
        <Link
          href={`/jobs/${jobId}/invoices/${invoiceId}`}
          className="text-zinc-700 hover:text-black text-sm"
        >
          ← Back to Invoice
        </Link>
        <button
          id="trigger-print"
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded"
        >
          🖨 Print
        </button>
      </div>

      <div className="max-w-[8.5in] mx-auto px-12 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Letterhead */}
        <header className="flex justify-between items-start pb-5 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">FC</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">First Call Mitigation</h1>
                <p className="text-xs text-zinc-600 uppercase tracking-wider">
                  Water · Fire · Mold Restoration
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-700 leading-relaxed">
              <p>Austin, Texas</p>
              <p>Licensed · Bonded · Insured · IICRC Certified</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold tracking-tight">INVOICE</p>
            <table className="text-xs mt-2 ml-auto">
              <tbody>
                <tr>
                  <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                    Invoice #
                  </td>
                  <td className="text-right font-mono font-semibold">
                    {invoice.invoice_number}
                  </td>
                </tr>
                <tr>
                  <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                    Issued
                  </td>
                  <td className="text-right font-mono">{dateFmt(issueDate)}</td>
                </tr>
                {dueDate && (
                  <tr>
                    <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                      Due
                    </td>
                    <td className="text-right font-mono">{dateFmt(dueDate)}</td>
                  </tr>
                )}
                <tr>
                  <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                    Job #
                  </td>
                  <td className="text-right font-mono">{(job as any).job_number}</td>
                </tr>
                {invoice.status === "paid" && (
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-right">
                      <span className="inline-block px-2 py-0.5 bg-green-100 border border-green-700 text-green-900 text-[10px] font-bold uppercase tracking-wider rounded">
                        Paid in Full
                      </span>
                    </td>
                  </tr>
                )}
                {invoice.status === "void" && (
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-right">
                      <span className="inline-block px-2 py-0.5 bg-red-100 border border-red-700 text-red-900 text-[10px] font-bold uppercase tracking-wider rounded">
                        Void
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </header>

        {/* Bill To / Loss / Insurance */}
        <section className="grid grid-cols-3 gap-6 mt-6 pb-5 border-b border-zinc-300 text-sm page-break-inside-avoid">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
              Bill To
            </p>
            <p className="font-semibold">{customer.name ?? "—"}</p>
            {customer.phone && <p className="text-xs">{customer.phone}</p>}
            {customer.email && <p className="text-xs">{customer.email}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
              Loss Location
            </p>
            <p className="font-semibold">{(job as any).site_address ?? "—"}</p>
            <p className="text-xs">
              {[(job as any).site_city, (job as any).site_state, (job as any).site_zip]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
              Insurance
            </p>
            {customer.insurance_company ? (
              <>
                <p className="font-semibold">{customer.insurance_company}</p>
                {customer.insurance_claim_number && (
                  <p className="text-xs">
                    <span className="text-zinc-600">Claim #</span>{" "}
                    <span className="font-mono">{customer.insurance_claim_number}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs italic text-zinc-500">Self-pay</p>
            )}
          </div>
        </section>

        {/* Line Items */}
        <section className="mt-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-[10px] uppercase tracking-wider text-zinc-700 font-semibold">
                <th className="text-left py-2 w-20">Code</th>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2 w-16">Qty</th>
                <th className="text-left py-2 w-12 pl-2">Unit</th>
                <th className="text-right py-2 w-24">Unit Price</th>
                <th className="text-right py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, ci) => (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  items={byCategory[cat]}
                  subtotal={subtotalsByCategory[cat]}
                  fmt={fmt}
                  isLast={ci === categories.length - 1}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black">
                <td colSpan={4}></td>
                <td className="text-right py-2 text-sm font-semibold uppercase tracking-wider">
                  Subtotal
                </td>
                <td className="text-right py-2 text-sm font-mono">{fmt(grandTotal)}</td>
              </tr>
              {totalPaid > 0 && (
                <tr>
                  <td colSpan={4}></td>
                  <td className="text-right py-1 text-sm font-semibold uppercase tracking-wider text-zinc-600">
                    Payments Received
                  </td>
                  <td className="text-right py-1 text-sm font-mono text-green-700">
                    -{fmt(totalPaid)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-black">
                <td colSpan={4}></td>
                <td className="text-right py-2.5 text-sm font-bold uppercase tracking-wider">
                  Balance Due
                </td>
                <td className="text-right py-2.5 text-lg font-bold font-mono">
                  {fmt(balance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Payment Terms */}
        <section className="mt-8 pt-5 border-t border-zinc-300 text-xs text-zinc-700 leading-relaxed page-break-inside-avoid">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
            Payment Terms
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Net 30 from invoice date.
              {dueDate && ` Payment due by ${dateFmt(dueDate)}.`}
            </li>
            <li>
              Per Tex. Ins. Code § 542.058, first-party insurance claims are subject to
              prompt-pay deadlines. Failure to pay timely may result in statutory penalty
              interest plus attorney's fees.
            </li>
            <li>
              Make checks payable to <strong>First Call Mitigation</strong>. For ACH/wire
              instructions, please contact our office.
            </li>
            <li>
              Questions on this invoice? Reply to the email on file or contact our
              office. Reference invoice #{" "}
              <span className="font-mono">{invoice.invoice_number}</span>.
            </li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-3 border-t border-zinc-300 text-[10px] text-zinc-500 text-center">
          First Call Mitigation · Austin, Texas · IICRC Certified · Invoice{" "}
          {invoice.invoice_number} · Generated {dateFmt(new Date())}
        </footer>
      </div>
    </div>
  );
}

function CategoryGroup({
  category,
  items,
  subtotal,
  fmt,
  isLast,
}: {
  category: string;
  items: any[];
  subtotal: number;
  fmt: (n: number) => string;
  isLast: boolean;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={6}
          className="pt-3 pb-1 text-[11px] uppercase tracking-wider font-bold text-blue-900 bg-zinc-50 border-y border-zinc-300 px-1"
        >
          {category}
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.id} className="border-b border-zinc-200 align-top">
          <td className="py-1.5 text-xs font-mono text-zinc-700">
            {item.xactimate_code ?? "—"}
          </td>
          <td className="py-1.5 text-sm pr-3">
            {item.description}
            {item.notes && (
              <p className="text-[10px] italic text-zinc-600 mt-0.5">{item.notes}</p>
            )}
          </td>
          <td className="py-1.5 text-right text-xs font-mono">
            {Number(item.quantity).toFixed(2)}
          </td>
          <td className="py-1.5 text-xs uppercase pl-2 text-zinc-600">{item.unit}</td>
          <td className="py-1.5 text-right text-xs font-mono">
            {fmt(Number(item.unit_price))}
          </td>
          <td className="py-1.5 text-right text-sm font-mono font-semibold">
            {fmt(Number(item.line_total))}
          </td>
        </tr>
      ))}
      <tr className={isLast ? "" : "border-b-2 border-zinc-400"}>
        <td colSpan={5} className="py-1.5 text-right text-[11px] uppercase tracking-wider font-semibold text-zinc-700">
          {category} subtotal
        </td>
        <td className="py-1.5 text-right text-sm font-mono font-bold">{fmt(subtotal)}</td>
      </tr>
    </>
  );
}
