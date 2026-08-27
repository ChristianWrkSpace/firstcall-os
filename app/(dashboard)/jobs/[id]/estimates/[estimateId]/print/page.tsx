import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import PrintTrigger from "./PrintTrigger";
import {
  loadArtifactForJob,
  requireArtifactForJob,
  requireFinancialQueryData,
  summarizePrintLineItems,
} from "@/lib/financial-document-integrity";

export default async function EstimatePrintPage({
  params,
}: {
  params: Promise<{ id: string; estimateId: string }>;
}) {
  const { id: jobId, estimateId } = await params;
  const supabase = await createServerSupabaseClient();

  const [estimateResult, lineItemsResult, jobResult] = await Promise.all([
    loadArtifactForJob(
      supabase
        .from("estimates")
        .select(
          "*, generated:profiles!generated_by(name), approver:profiles!approved_by(name)"
        ),
      estimateId,
      jobId
    ),
    supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("jobs")
      .select("*, customers(*)")
      .eq("id", jobId)
      .maybeSingle(),
  ]);

  if (estimateResult.error) throw new Error("Unable to load estimate");
  if (jobResult.error) throw new Error("Unable to load estimate job");
  const estimate = requireArtifactForJob(estimateResult.data, jobId, notFound);
  if (!jobResult.data) notFound();
  const job = jobResult.data;
  const lineItems = requireFinancialQueryData(lineItemsResult, "estimate line items");

  const customer = (job as any).customers ?? {};
  const items = lineItems;
  const meta = (estimate as any).generation_meta ?? {};

  const categoryOrder = [
    "Water Extraction",
    "Equipment Setup",
    "Daily Drying",
    "Demolition",
    "Cleaning & Antimicrobial",
    "Containment",
    "Other",
  ];
  const { byCategory, categories, subtotalsByCategory, grandTotal } =
    summarizePrintLineItems(items, categoryOrder);

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="print-page bg-white text-black min-h-screen">
      <PrintTrigger />

      {/* Top toolbar — hidden on print */}
      <div className="no-print bg-zinc-100 border-b border-zinc-300 px-6 py-3 flex items-center justify-between">
        <Link
          href={`/jobs/${jobId}/estimates/${estimateId}`}
          className="text-zinc-700 hover:text-black text-sm"
        >
          ← Back to Estimate
        </Link>
        <button
          id="trigger-print"
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded"
        >
          🖨 Print
        </button>
      </div>

      {/* The actual document */}
      <div className="max-w-[8.5in] mx-auto px-12 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* ───── Letterhead ───── */}
        <header className="flex justify-between items-start pb-5 border-b-2 border-black">
          <div>
            <Logo variant="banner" size={48} priority />
            <p className="text-xs text-zinc-600 uppercase tracking-wider mt-2">
              Water · Fire · Mold Restoration
            </p>
            <div className="mt-3 text-xs text-zinc-700 leading-relaxed">
              <p>Austin, Texas</p>
              <p>Licensed · Bonded · Insured · IICRC Certified</p>
              <p>24/7 Emergency Response</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold tracking-tight">ESTIMATE</p>
            <table className="text-xs mt-2 ml-auto">
              <tbody>
                <tr>
                  <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                    Estimate #
                  </td>
                  <td className="text-right font-mono font-semibold">
                    {(job as any).job_number}-V{estimate.version}
                  </td>
                </tr>
                <tr>
                  <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                    Date
                  </td>
                  <td className="text-right font-mono">{formattedDate}</td>
                </tr>
                <tr>
                  <td className="text-zinc-600 uppercase tracking-wider pr-3 py-0.5">
                    Job #
                  </td>
                  <td className="text-right font-mono">{(job as any).job_number}</td>
                </tr>
                {estimate.status === "approved" && (
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-right">
                      <span className="inline-block px-2 py-0.5 bg-green-100 border border-green-700 text-green-900 text-[10px] font-bold uppercase tracking-wider rounded">
                        Approved
                      </span>
                    </td>
                  </tr>
                )}
                {estimate.status === "sent" && (
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-right">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 border border-blue-700 text-blue-900 text-[10px] font-bold uppercase tracking-wider rounded">
                        Sent
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </header>

        {/* ───── Bill To / Property / Insurance ───── */}
        <section className="grid grid-cols-3 gap-6 mt-6 pb-5 border-b border-zinc-300 text-sm page-break-inside-avoid">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
              Insured / Bill To
            </p>
            <p className="font-semibold">{customer.name ?? "—"}</p>
            {customer.phone && <p className="text-xs">{customer.phone}</p>}
            {customer.email && <p className="text-xs">{customer.email}</p>}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
              Property / Loss Location
            </p>
            <p className="font-semibold">{(job as any).site_address ?? "—"}</p>
            <p className="text-xs">
              {[(job as any).site_city, (job as any).site_state, (job as any).site_zip]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
            <p className="text-xs text-zinc-600 mt-1 capitalize">
              {(job as any).type} damage
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
                {customer.insurance_policy_number && (
                  <p className="text-xs">
                    <span className="text-zinc-600">Policy #</span>{" "}
                    <span className="font-mono">{customer.insurance_policy_number}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs italic text-zinc-500">Self-pay / No insurance on file</p>
            )}
          </div>
        </section>

        {/* ───── Scope Summary ───── */}
        {meta.summary && (
          <section className="mt-5 pb-5 border-b border-zinc-300 page-break-inside-avoid">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
              Scope of Work
            </p>
            <p className="text-sm leading-relaxed">{meta.summary}</p>
          </section>
        )}

        {/* ───── Line Items ───── */}
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
                <td className="text-right py-2.5 text-sm font-semibold uppercase tracking-wider">
                  Total Estimate
                </td>
                <td className="text-right py-2.5 text-lg font-bold font-mono">
                  {fmt(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ───── Terms & Conditions ───── */}
        <section className="mt-8 pt-5 border-t border-zinc-300 text-xs text-zinc-700 leading-relaxed page-break-inside-avoid">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
            Terms & Conditions
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              This estimate covers emergency mitigation services only. Reconstruction,
              build-back, and content cleaning are billed separately under a supplemental
              estimate.
            </li>
            <li>
              Quantities are based on initial scope assessment per IICRC S500/S520
              standards and may be adjusted upon completion of work via supplemental
              billing.
            </li>
            <li>
              Daily equipment charges accrue from set-up through removal. Estimated drying
              time may extend if affected materials require additional days.
            </li>
            <li>
              Payment terms: net 30 from completion of work. Insurance proceeds may be
              assigned to First Call Mitigation via separate Assignment of Benefits.
            </li>
            <li>
              First Call Mitigation reserves the right to renegotiate this estimate based
              on actual site conditions discovered during work.
            </li>
          </ol>
        </section>

        {/* ───── Signatures ───── */}
        <section className="mt-8 pt-5 border-t-2 border-black grid grid-cols-2 gap-10 text-sm page-break-inside-avoid">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-6">
              Customer / Insured Approval
            </p>
            <div className="border-b border-black h-1"></div>
            <p className="text-[10px] text-zinc-600 mt-1">Signature</p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <div className="border-b border-black h-1"></div>
                <p className="text-[10px] text-zinc-600 mt-1">Print Name</p>
              </div>
              <div>
                <div className="border-b border-black h-1"></div>
                <p className="text-[10px] text-zinc-600 mt-1">Date</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-6">
              First Call Mitigation
            </p>
            <div className="border-b border-black h-1"></div>
            <p className="text-[10px] text-zinc-600 mt-1">
              Authorized Representative
            </p>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p className="text-xs font-semibold">
                  {(estimate as any).approver?.name ??
                    (estimate as any).generated?.name ??
                    "—"}
                </p>
                <p className="text-[10px] text-zinc-600">Print Name</p>
              </div>
              <div>
                <p className="text-xs font-semibold">{formattedDate}</p>
                <p className="text-[10px] text-zinc-600">Date</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-3 border-t border-zinc-300 text-[10px] text-zinc-500 text-center">
          First Call Mitigation · Austin, Texas · IICRC Certified · Estimate{" "}
          {(job as any).job_number}-V{estimate.version} · Generated {formattedDate}
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
        <td className="py-1.5 text-right text-sm font-mono font-bold">
          {fmt(subtotal)}
        </td>
      </tr>
    </>
  );
}
