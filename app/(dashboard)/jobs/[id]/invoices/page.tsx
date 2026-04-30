import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  draft:   "bg-zinc-700 text-zinc-300",
  sent:    "bg-blue-500/15 text-blue-400",
  partial: "bg-yellow-500/15 text-yellow-400",
  paid:    "bg-green-500/15 text-green-400",
  overdue: "bg-red-500/15 text-red-400",
  void:    "bg-zinc-800 text-zinc-500",
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
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Back to Job
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Invoices</h1>
      </div>

      {!invoices?.length ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 text-sm mb-2">No invoices yet for this job.</p>
          <p className="text-zinc-500 text-xs">
            Approve an estimate first, then generate an invoice from it.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
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
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/jobs/${id}/invoices/${inv.id}`}
                        className="text-blue-400 hover:underline font-mono text-xs"
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
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {new Date(inv.issue_date ?? inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-white font-mono">
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
