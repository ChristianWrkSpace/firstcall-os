import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import LineItemsTable from "./LineItemsTable";
import EstimateActions from "./EstimateActions";
import GenerateInvoiceButton from "./GenerateInvoiceButton";
import { Glass, PageBackdrop } from "@/components/ui/Glass";

// Estimate-status pills in the glass palette.
const ESTIMATE_STATUS_GLASS: Record<string, string> = {
  draft:    "bg-white/5 text-white/60 ring-white/10",
  approved: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  sent:     "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  rejected: "bg-red-400/10 text-red-300 ring-red-400/20",
  revised:  "bg-amber-400/10 text-amber-300 ring-amber-400/20",
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string; estimateId: string }>;
}) {
  const { id: jobId, estimateId } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: estimate }, { data: lineItems }, { data: job }] = await Promise.all([
    supabase
      .from("estimates")
      .select(
        "*, generated:profiles!generated_by(name), approver:profiles!approved_by(name)"
      )
      .eq("id", estimateId)
      .single(),
    supabase
      .from("estimate_line_items")
      .select("*")
      .eq("estimate_id", estimateId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("jobs")
      .select("job_number, customers(name, insurance_company)")
      .eq("id", jobId)
      .single(),
  ]);

  if (!estimate) notFound();

  const items = lineItems ?? [];
  const total = items.reduce((sum, li: any) => sum + Number(li.line_total ?? 0), 0);
  const meta = estimate.generation_meta ?? {};
  const isLocked = estimate.status === "approved" || estimate.status === "sent";

  // Pricing confidence breakdown — how much of the total is anchored to the
  // reviewed price book vs how much is the LLM's best guess. The operator
  // should scrutinize the 'guessed' subtotal before approving.
  let bookCount = 0;
  let guessedCount = 0;
  let bookSubtotal = 0;
  let guessedSubtotal = 0;
  for (const li of items as any[]) {
    const source = li.pricing_source as "book" | "guessed" | null;
    const lineTotal = Number(li.line_total ?? 0);
    if (source === "book") {
      bookCount++;
      bookSubtotal += lineTotal;
    } else if (source === "guessed") {
      guessedCount++;
      guessedSubtotal += lineTotal;
    }
  }
  const taggedCount = bookCount + guessedCount;
  const bookPctOfTotal = total > 0 ? (bookSubtotal / total) * 100 : 0;

  // Group line items by category
  const byCategory: Record<string, any[]> = {};
  for (const li of items) {
    const cat = li.category ?? "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(li);
  }

  return (
    <PageBackdrop>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Link
              href={`/jobs/${jobId}`}
              className="text-white/40 hover:text-white text-sm transition-colors"
            >
              ← Back to job
            </Link>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-white/95">
                Estimate <span className="font-mono text-[#A6B8E7]">v{estimate.version}</span>
              </h1>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ring-1 ${ESTIMATE_STATUS_GLASS[estimate.status] ?? ESTIMATE_STATUS_GLASS.draft}`}
              >
                {estimate.status}
              </span>
            </div>
            {(job as any) && (
              <p className="text-white/45 text-sm mt-1">
                <Link
                  href={`/jobs/${jobId}`}
                  className="text-[#A6B8E7] hover:text-white font-mono transition-colors"
                >
                  {(job as any).job_number}
                </Link>
                {" · "}
                {(job as any).customers?.name ?? "—"}
                {(job as any).customers?.insurance_company &&
                  ` · ${(job as any).customers.insurance_company}`}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-white/40 text-[10px] uppercase tracking-[0.15em]">Total</p>
            <p className="text-3xl font-bold text-white/95 font-mono">{fmt(total)}</p>
          </div>
        </div>

        {/* AI disclaimer — human-in-loop, amber */}
        {estimate.status === "draft" && (
          <div className="bg-amber-400/[0.06] border border-amber-400/20 rounded-xl px-4 py-3 mb-5">
            <p className="text-amber-300 text-sm font-medium">
              ⚠️ AI-drafted estimate — review every line item, especially unit prices, before approval.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Left: line items */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            {meta.summary && (
              <Glass className="p-5">
                <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Summary</p>
                <p className="text-white/80 text-sm leading-relaxed">{meta.summary}</p>
              </Glass>
            )}

            {taggedCount > 0 && (
              <Glass className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/40 text-xs uppercase tracking-wide">
                    Pricing Confidence
                  </p>
                  <Link
                    href="/settings/price-book"
                    className="text-[#A6B8E7] hover:text-white text-xs transition-colors"
                  >
                    Manage price book →
                  </Link>
                </div>
                <div className="flex h-2 rounded overflow-hidden bg-white/10 mb-3">
                  <div
                    className="bg-emerald-400/70"
                    style={{ width: `${bookPctOfTotal}%` }}
                    title={`Book: ${fmt(bookSubtotal)}`}
                  />
                  <div
                    className="bg-amber-400/70"
                    style={{ width: `${100 - bookPctOfTotal}%` }}
                    title={`Guessed: ${fmt(guessedSubtotal)}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-emerald-300 font-semibold">
                      {bookCount} {bookCount === 1 ? "line" : "lines"} from book
                    </p>
                    <p className="text-white/55 font-mono">
                      {fmt(bookSubtotal)}{" "}
                      <span className="text-white/35">({bookPctOfTotal.toFixed(0)}% of total)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-300 font-semibold">
                      {guessedCount} AI {guessedCount === 1 ? "guess" : "guesses"}
                    </p>
                    <p className="text-white/55 font-mono">
                      {fmt(guessedSubtotal)}{" "}
                      <span className="text-white/35">— verify before sending</span>
                    </p>
                  </div>
                </div>
              </Glass>
            )}

            <Glass className="overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-white/90 font-semibold">Line Items</h2>
                <p className="text-white/40 text-xs">{items.length} items</p>
              </div>
              <LineItemsTable
                estimateId={estimateId}
                jobId={jobId}
                itemsByCategory={byCategory}
                total={total}
                locked={isLocked}
              />
            </Glass>
          </div>

          {/* Right: actions + meta */}
          <div className="flex flex-col gap-5">
            <Glass className="p-5">
              <h2 className="text-white/90 font-semibold mb-3">Actions</h2>
              <EstimateActions
                estimateId={estimateId}
                jobId={jobId}
                status={estimate.status}
                total={total}
              />
              {(estimate.status === "approved" || estimate.status === "sent") && (
                <div className="mt-3 pt-3 border-t border-white/[0.08]">
                  <GenerateInvoiceButton estimateId={estimateId} jobId={jobId} />
                  <p className="text-white/40 text-[10px] mt-1.5 leading-snug">
                    Creates a draft invoice with these line items, ready to send to the
                    carrier.
                  </p>
                </div>
              )}
            </Glass>

            <Glass className="p-5">
              <h2 className="text-white/90 font-semibold mb-3">Meta</h2>
              <dl className="text-sm space-y-2">
                <Meta label="Generated" value={new Date(estimate.created_at).toLocaleString()} />
                {(estimate as any).generated?.name && (
                  <Meta label="Generated by" value={(estimate as any).generated.name} />
                )}
                {estimate.approved_at && (
                  <Meta
                    label="Approved"
                    value={new Date(estimate.approved_at).toLocaleString()}
                  />
                )}
                {(estimate as any).approver?.name && (
                  <Meta label="Approved by" value={(estimate as any).approver.name} />
                )}
                {estimate.sent_at && (
                  <Meta label="Sent" value={new Date(estimate.sent_at).toLocaleString()} />
                )}
                {estimate.sent_to && <Meta label="Sent to" value={estimate.sent_to} />}
              </dl>
            </Glass>

            {meta.assumptions && Array.isArray(meta.assumptions) && meta.assumptions.length > 0 && (
              <Glass accent="blue" subtle className="p-5">
                <h2 className="text-[#A6B8E7] font-semibold text-sm mb-2">
                  ⚠ Verify These Assumptions
                </h2>
                <ul className="text-white/70 text-xs space-y-1">
                  {meta.assumptions.map((a: string, i: number) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </Glass>
            )}

            {meta.notes_for_estimator && (
              <Glass className="p-5">
                <h2 className="text-white/90 font-semibold text-sm mb-2">
                  Notes for Estimator
                </h2>
                <p className="text-white/70 text-xs leading-relaxed">
                  {meta.notes_for_estimator}
                </p>
              </Glass>
            )}
          </div>
        </div>
      </div>
    </PageBackdrop>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-white/40 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-white/70 text-xs">{value}</dd>
    </div>
  );
}
