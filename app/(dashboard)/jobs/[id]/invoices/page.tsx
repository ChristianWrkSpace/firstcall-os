import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell, GlassRow, EmptyState } from "@/components/ui/Glass";

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

export default async function InvoicesIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: invoices }, { data: job }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, line_items:invoice_line_items(line_total)")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("jobs").select("job_number").eq("id", id).single(),
  ]);

  // Single invoice → jump straight to detail
  if (invoices && invoices.length === 1) {
    redirect(`/jobs/${id}/invoices/${invoices[0].id}`);
  }

  return (
    <PageShell
      eyebrow="Billing"
      title="Invoices"
      subtitle={`${invoices?.length ?? 0} for job ${job?.job_number ?? ""}`}
      action={
        <Link
          href={`/jobs/${id}`}
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Back to job
        </Link>
      }
      width="wide"
    >
      {!invoices?.length ? (
        <EmptyState icon="💵" title="No invoices yet for this job.">
          Approve an estimate first, then generate an invoice from it.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((inv: any, i: number) => {
            const total = (inv.line_items ?? []).reduce(
              (s: number, li: any) => s + Number(li.line_total ?? 0),
              0
            );
            return (
              <GlassRow
                key={inv.id}
                href={`/jobs/${id}/invoices/${inv.id}`}
                index={i}
                accent="blue"
                meta={
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${INVOICE_STATUS_GLASS[inv.status] ?? INVOICE_STATUS_GLASS.draft}`}
                  >
                    {inv.status}
                  </span>
                }
                title={<span className="font-mono text-[#A6B8E7]">{inv.invoice_number}</span>}
                sub={`Issued ${new Date(inv.issue_date ?? inv.created_at).toLocaleDateString()}${inv.due_date ? ` · due ${new Date(inv.due_date).toLocaleDateString()}` : ""}`}
                trailing={<span className="text-white/95 font-mono font-semibold">{fmt(total)}</span>}
              />
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
