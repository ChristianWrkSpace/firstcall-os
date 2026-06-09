import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";

export default async function CallsPage() {
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  let callsQuery = supabase
    .from("calls")
    .select("*, jobs(job_number, type)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (cutoff) callsQuery = callsQuery.gte("created_at", cutoff);
  const { data: calls } = await callsQuery;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Calls</h1>
          <p className="text-ink-2 text-sm mt-0.5">AI-transcribed intake calls</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/calls/simulate"
            className="px-4 py-2 border border-edge2 hover:bg-shade text-ink text-sm font-medium rounded-lg transition-colors"
          >
            🎙 Talk to Athena
          </Link>
          <Link
            href="/calls/new"
            className="px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Call
          </Link>
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        {!calls?.length ? (
          <div className="px-5 py-10 text-center text-ink-3 text-sm">
            No calls recorded yet.{" "}
            <Link href="/calls/new" className="text-info hover:underline">
              Record one →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Job</th>
                <th className="px-5 py-3 text-left">Summary</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr
                  key={call.id}
                  className="border-b border-edge2 last:border-0 hover:bg-shade transition-colors"
                >
                  <td className="px-5 py-3">
                    {(call.jobs as any)?.job_number ? (
                      <Link
                        href={`/jobs/${call.job_id}`}
                        className="text-info hover:underline font-mono text-xs"
                      >
                        {(call.jobs as any).job_number}
                      </Link>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink max-w-xs truncate">
                    {call.ai_summary ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-2 text-xs capitalize">
                    {(call.jobs as any)?.type ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-3 text-xs">
                    {new Date(call.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
