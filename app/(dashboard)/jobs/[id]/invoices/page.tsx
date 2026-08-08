import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  draft:   "bg-shade text-ink-2",
  sent:    "bg-info/10 text-info",
  partial: "bg-honey/10 text-honey",
  paid:    "bg-pine/10 text-pine",
  overdue: "bg-red-600/10 text-red-700",
  void:    "bg-shade text-ink-3",
};

export default async function InvoicesIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, line_items:invoice_line_items(line_total)")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // Single invoice → jump straight to detail
  if (invoices && invoices.length === 1) {
    redirect(`/jobs/${id}/invoices/${invoices[0].id}`);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href={`/jobs/${id}`}
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Back to Job
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Invoices</h1>
      </div>

      {!invoices?.length ? (
        <div className="glass-card p-8 text-center">
          <p className="text-ink-2 text-sm mb-2">No invoices yet for this job.</p>
          <p className="text-ink-3 text-xs">
            Approve an estimate first, then generate an invoice from it.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Invoice #</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Issued</th>
                <th className="px-5 py-3 text-left">Due</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => {
                const total = (inv.line_items ?? []).reduce(
                  (s: number, li: any) => s + Number(li.line_total ?? 0),
                  0
                );
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-edge2 last:border-0 hover:bg-shade transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/jobs/${id}/invoices/${inv.id}`}
                        className="text-info hover:underline font-mono text-xs"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] ?? ""}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-2 text-xs">
                      {new Date(inv.issue_date ?? inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-ink-2 text-xs">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-ink font-mono">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
