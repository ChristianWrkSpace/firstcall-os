import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import InvoiceLineTable from "./InvoiceLineTable";
import InvoiceActions from "./InvoiceActions";
import PaymentsPanel from "./PaymentsPanel";
import RemindersPanel from "./RemindersPanel";

const STATUS_COLORS: Record<string, string> = {
  draft:   "bg-zinc-700 text-zinc-300",
  sent:    "bg-blue-500/15 text-blue-400",
  partial: "bg-yellow-500/15 text-yellow-400",
  paid:    "bg-green-500/15 text-green-400",
  overdue: "bg-red-500/15 text-red-400",
  void:    "bg-zinc-800 text-zinc-500",
};

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
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={`/jobs/${jobId}`}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Back to Job
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white font-mono">
              {invoice.invoice_number}
            </h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[invoice.status] ?? ""}`}
            >
              {invoice.status}
            </span>
            {daysOutstanding !== null && invoice.status !== "paid" && invoice.status !== "void" && (
              <span
                className={`text-xs ${daysOutstanding > 60 ? "text-red-400" : daysOutstanding > 30 ? "text-yellow-400" : "text-zinc-400"}`}
              >
                {daysOutstanding}d outstanding
              </span>
            )}
          </div>
          {(job as any) && (
            <p className="text-zinc-400 text-sm mt-1">
              <Link
                href={`/jobs/${jobId}`}
                className="text-blue-400 hover:underline font-mono"
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
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Balance Due</p>
          <p className={`text-3xl font-bold font-mono ${balance > 0 ? "text-white" : "text-green-400"}`}>
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {paid > 0 && (
            <p className="text-zinc-500 text-xs mt-0.5">
              ${paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid
              {" of "}
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 flex flex-col gap-5">
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Line Items</h2>
              <p className="text-zinc-500 text-xs">{items.length} items · ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <InvoiceLineTable
              invoiceId={invoiceId}
              jobId={jobId}
              itemsByCategory={byCategory}
              total={total}
              locked={locked}
            />
          </section>

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
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">Actions</h2>
            <InvoiceActions
              invoiceId={invoiceId}
              jobId={jobId}
              status={invoice.status}
              defaultRecipient={invoice.sent_to ?? ""}
              hasBeenSent={!!invoice.sent_at}
            />
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3">Meta</h2>
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
          </section>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-zinc-500 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-zinc-200 text-xs">{value}</dd>
    </div>
  );
}
