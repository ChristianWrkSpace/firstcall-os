import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-zinc-700 text-zinc-300",
  approved: "bg-green-500/15 text-green-400",
  sent:     "bg-blue-500/15 text-blue-400",
  rejected: "bg-red-500/15 text-red-400",
  revised:  "bg-yellow-500/15 text-yellow-400",
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
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/jobs/${id}`}
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Back to Job
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Estimates</h1>
      </div>

      {!estimates?.length ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 text-sm mb-3">No estimates yet for this job.</p>
          <p className="text-zinc-500 text-xs">
            Generate one from the job detail page after running Argus scope analysis.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
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
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/jobs/${id}/estimates/${est.id}`}
                        className="text-blue-400 hover:underline font-mono"
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
                    <td className="px-5 py-3 text-right text-zinc-300 font-mono text-xs">
                      {(est.line_items ?? []).length}
                    </td>
                    <td className="px-5 py-3 text-right text-white font-mono">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">
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
