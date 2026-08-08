import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-shade text-ink-2",
  approved: "bg-pine/10 text-pine",
  sent:     "bg-info/10 text-info",
  rejected: "bg-red-600/10 text-red-700",
  revised:  "bg-honey/10 text-honey",
};

export default async function EstimatesIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: estimates } = await supabase
    .from("estimates")
    .select("*, line_items:estimate_line_items(line_total)")
    .eq("job_id", id)
    .order("version", { ascending: false });

  // If exactly one estimate exists, jump straight to it for convenience
  if (estimates && estimates.length === 1) {
    redirect(`/jobs/${id}/estimates/${estimates[0].id}`);
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
        <h1 className="text-2xl font-bold text-ink mt-2">Estimates</h1>
      </div>

      {!estimates?.length ? (
        <div className="glass-card p-8 text-center">
          <p className="text-ink-2 text-sm mb-3">No estimates yet for this job.</p>
          <p className="text-ink-3 text-xs">
            Generate one from the job detail page after running Argus scope analysis.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Version</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Line Items</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((est: any) => {
                const total = (est.line_items ?? []).reduce(
                  (sum: number, li: any) => sum + Number(li.line_total ?? 0),
                  0
                );
                return (
                  <tr
                    key={est.id}
                    className="border-b border-edge2 last:border-0 hover:bg-shade transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/jobs/${id}/estimates/${est.id}`}
                        className="text-info hover:underline font-mono"
                      >
                        v{est.version}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[est.status] ?? ""}`}
                      >
                        {est.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 font-mono text-xs">
                      {(est.line_items ?? []).length}
                    </td>
                    <td className="px-5 py-3 text-right text-ink font-mono">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-ink-3 text-xs">
                      {new Date(est.created_at).toLocaleDateString()}
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
