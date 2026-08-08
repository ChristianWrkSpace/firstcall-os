import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import LineItemsTable from "./LineItemsTable";
import EstimateActions from "./EstimateActions";

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-shade text-ink-2",
  approved: "bg-pine/10 text-pine",
  sent:     "bg-info/10 text-info",
  rejected: "bg-red-600/10 text-red-700",
  revised:  "bg-honey/10 text-honey",
};

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
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={`/jobs/${jobId}`}
            className="text-ink-3 hover:text-ink text-sm transition-colors"
          >
            ← Back to Job
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-2xl font-bold text-ink">
              Estimate <span className="font-mono text-info">v{estimate.version}</span>
            </h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[estimate.status] ?? ""}`}
            >
              {estimate.status}
            </span>
          </div>
          {(job as any) && (
            <p className="text-ink-2 text-sm mt-1">
              <Link
                href={`/jobs/${jobId}`}
                className="text-info hover:underline font-mono"
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
          <p className="text-ink-3 text-xs uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-ink font-mono">
            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* AI disclaimer */}
      {estimate.status === "draft" && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3 mb-5">
          <p className="text-honey text-sm font-medium">
            ⚠️ AI-drafted estimate — review every line item, especially unit prices, before approval.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left: line items */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          {meta.summary && (
            <section className="glass-card p-5">
              <p className="text-ink-3 text-xs uppercase tracking-wide mb-1">Summary</p>
              <p className="text-ink text-sm leading-relaxed">{meta.summary}</p>
            </section>
          )}

          {taggedCount > 0 && (
            <section className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-ink-3 text-xs uppercase tracking-wide">
                  Pricing Confidence
                </p>
                <Link
                  href="/settings/price-book"
                  className="text-info hover:underline text-xs"
                >
                  Manage price book →
                </Link>
              </div>
              <div className="flex h-2 rounded overflow-hidden bg-shade mb-3">
                <div
                  className="bg-green-500/70"
                  style={{ width: `${bookPctOfTotal}%` }}
                  title={`Book: $${bookSubtotal.toFixed(2)}`}
                />
                <div
                  className="bg-yellow-500/70"
                  style={{ width: `${100 - bookPctOfTotal}%` }}
                  title={`Guessed: $${guessedSubtotal.toFixed(2)}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-pine font-semibold">
                    {bookCount} {bookCount === 1 ? "line" : "lines"} from book
                  </p>
                  <p className="text-ink-2 font-mono">
                    ${bookSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {" "}
                    <span className="text-ink-3">({bookPctOfTotal.toFixed(0)}% of total)</span>
                  </p>
                </div>
                <div>
                  <p className="text-honey font-semibold">
                    {guessedCount} AI {guessedCount === 1 ? "guess" : "guesses"}
                  </p>
                  <p className="text-ink-2 font-mono">
                    ${guessedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {" "}
                    <span className="text-ink-3">— verify before sending</span>
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-edge2 flex items-center justify-between">
              <h2 className="text-ink font-semibold">Line Items</h2>
              <p className="text-ink-3 text-xs">{items.length} items</p>
            </div>
            <LineItemsTable
              estimateId={estimateId}
              jobId={jobId}
              itemsByCategory={byCategory}
              total={total}
              locked={isLocked}
            />
          </section>
        </div>

        {/* Right: actions + meta */}
        <div className="flex flex-col gap-5">
          <section className="glass-card p-5">
            <h2 className="text-ink font-semibold mb-3">Actions</h2>
            <EstimateActions
              estimateId={estimateId}
              jobId={jobId}
              status={estimate.status}
              total={total}
            />
          </section>

          <section className="glass-card p-5">
            <h2 className="text-ink font-semibold mb-3">Meta</h2>
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
          </section>

          {meta.assumptions && Array.isArray(meta.assumptions) && meta.assumptions.length > 0 && (
            <section className="bg-blue-500/5 border border-info/20 rounded-xl p-5">
              <h2 className="text-info font-semibold text-sm mb-2">
                ⚠ Verify These Assumptions
              </h2>
              <ul className="text-ink-2 text-xs space-y-1">
                {meta.assumptions.map((a: string, i: number) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </section>
          )}

          {meta.notes_for_estimator && (
            <section className="glass-card p-5">
              <h2 className="text-ink font-semibold text-sm mb-2">
                Notes for Estimator
              </h2>
              <p className="text-ink-2 text-xs leading-relaxed">
                {meta.notes_for_estimator}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-ink-3 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-ink text-xs">{value}</dd>
    </div>
  );
}
