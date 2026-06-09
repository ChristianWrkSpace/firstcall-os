import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell, GlassRow, EmptyState } from "@/components/ui/Glass";

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

export default async function EstimatesIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: estimates }, { data: job }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, line_items:estimate_line_items(line_total)")
      .eq("job_id", id)
      .order("version", { ascending: false }),
    supabase.from("jobs").select("job_number").eq("id", id).single(),
  ]);

  // If exactly one estimate exists, jump straight to it for convenience
  if (estimates && estimates.length === 1) {
    redirect(`/jobs/${id}/estimates/${estimates[0].id}`);
  }

  return (
    <PageShell
      eyebrow="Pricing"
      title="Estimates"
      subtitle={`${estimates?.length ?? 0} for job ${job?.job_number ?? ""}`}
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
      {!estimates?.length ? (
        <EmptyState icon="🧮" title="No estimates yet for this job.">
          Generate one from the job detail page after running Argus scope analysis.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {estimates.map((est: any, i: number) => {
            const total = (est.line_items ?? []).reduce(
              (sum: number, li: any) => sum + Number(li.line_total ?? 0),
              0
            );
            return (
              <GlassRow
                key={est.id}
                href={`/jobs/${id}/estimates/${est.id}`}
                index={i}
                accent="blue"
                meta={
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${ESTIMATE_STATUS_GLASS[est.status] ?? ESTIMATE_STATUS_GLASS.draft}`}
                  >
                    {est.status}
                  </span>
                }
                title={
                  <span>
                    <span className="text-[#A6B8E7] font-mono">v{est.version}</span> Estimate
                  </span>
                }
                sub={`${(est.line_items ?? []).length} line items · created ${new Date(est.created_at).toLocaleDateString()}`}
                trailing={<span className="text-white/95 font-mono font-semibold">{fmt(total)}</span>}
              />
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
