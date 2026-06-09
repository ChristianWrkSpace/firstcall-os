import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import InvoiceLineTable from "./InvoiceLineTable";
import InvoiceActions from "./InvoiceActions";
import PaymentsPanel from "./PaymentsPanel";
import RemindersPanel from "./RemindersPanel";
import { Glass, PageBackdrop } from "@/components/ui/Glass";

// Invoice-status pills in the glass palette (mirrors the A/R dashboard).
const INVOICE_STATUS_GLASS: Record<string, string> = {
  draft:   "bg-white/5 text-white/60 ring-white/10",
  sent:    "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  partial: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  paid:    "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  overdue: "bg-red-400/10 text-red-300 ring-red-400/20",
  void:    "bg-white/5 text-white/35 ring-white/10",
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id: jobId, invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const [
    { data: invoice },
    { data: lineItems },
    { data: payments },
    { data: reminders },
    { data: job },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, creator:profiles!created_by(name)")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("payments")
      .select("*, recorder:profiles!recorded_by(name)")
      .eq("invoice_id", invoiceId)
      .order("received_at", { ascending: false }),
    supabase
      .from("invoice_reminders")
      .select("*, sender:profiles!sent_by(name)")
      .eq("invoice_id", invoiceId)
      .order("sent_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("job_number, customers(name, insurance_company)")
      .eq("id", jobId)
      .single(),
  ]);

  if (!invoice) notFound();

  const items = lineItems ?? [];
  const total = items.reduce((s, li: any) => s + Number(li.line_total ?? 0), 0);
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = total - paid;
  const locked = invoice.status !== "draft";

  // Group by category
  const byCategory: Record<string, any[]> = {};
  for (const li of items) {
    const cat = li.category ?? "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(li);
  }

  // Days outstanding
  const daysOutstanding = invoice.sent_at
    ? Math.floor((Date.now() - new Date(invoice.sent_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

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
              <h1 className="text-2xl font-semibold tracking-tight text-white/95 font-mono">
                {invoice.invoice_number}
              </h1>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ring-1 ${INVOICE_STATUS_GLASS[invoice.status] ?? INVOICE_STATUS_GLASS.draft}`}
              >
                {invoice.status}
              </span>
              {daysOutstanding !== null && invoice.status !== "paid" && invoice.status !== "void" && (
                <span
                  className={`text-xs font-mono ${daysOutstanding > 60 ? "text-red-400" : daysOutstanding > 30 ? "text-amber-300" : "text-white/40"}`}
                >
                  {daysOutstanding}d outstanding
                </span>
              )}
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
            <p className="text-white/40 text-[10px] uppercase tracking-[0.15em]">Balance Due</p>
            <p className={`text-3xl font-bold font-mono ${balance > 0 ? "text-white/95" : "text-emerald-300"}`}>
              {fmt(balance)}
            </p>
            {paid > 0 && (
              <p className="text-white/40 text-xs mt-0.5">
                {fmt(paid)} paid of {fmt(total)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <Glass className="overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-white/90 font-semibold">Line Items</h2>
                <p className="text-white/40 text-xs">
                  {items.length} items · {fmt(total)}
                </p>
              </div>
              <InvoiceLineTable
                invoiceId={invoiceId}
                jobId={jobId}
                itemsByCategory={byCategory}
                total={total}
                locked={locked}
              />
            </Glass>

            <PaymentsPanel
              invoiceId={invoiceId}
              jobId={jobId}
              payments={payments ?? []}
              balance={balance}
              invoiceLocked={invoice.status === "void"}
            />

            {(reminders ?? []).length > 0 && (
              <RemindersPanel reminders={reminders ?? []} />
            )}
          </div>

          <div className="flex flex-col gap-5">
            <Glass className="p-5">
              <h2 className="text-white/90 font-semibold mb-3">Actions</h2>
              <InvoiceActions
                invoiceId={invoiceId}
                jobId={jobId}
                status={invoice.status}
                defaultRecipient={invoice.sent_to ?? ""}
                hasBeenSent={!!invoice.sent_at}
              />
            </Glass>

            <Glass className="p-5">
              <h2 className="text-white/90 font-semibold mb-3">Meta</h2>
              <dl className="text-sm space-y-2">
                <Meta label="Issued" value={new Date(invoice.issue_date ?? invoice.created_at).toLocaleDateString()} />
                {invoice.due_date && (
                  <Meta label="Due" value={new Date(invoice.due_date).toLocaleDateString()} />
                )}
                {invoice.sent_at && (
                  <Meta label="Sent" value={new Date(invoice.sent_at).toLocaleString()} />
                )}
                {invoice.sent_to && <Meta label="Sent to" value={invoice.sent_to} />}
                {invoice.paid_at && (
                  <Meta label="Paid" value={new Date(invoice.paid_at).toLocaleString()} />
                )}
                {(invoice as any).creator?.name && (
                  <Meta label="Created by" value={(invoice as any).creator.name} />
                )}
              </dl>
            </Glass>
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
