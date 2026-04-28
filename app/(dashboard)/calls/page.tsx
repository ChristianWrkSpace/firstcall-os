import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function CallsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: calls } = await supabase
    .from("calls")
    .select("*, jobs(job_number, type)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Calls</h1>
          <p className="text-zinc-400 text-sm mt-0.5">AI-transcribed intake calls</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/calls/simulate"
            className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm font-medium rounded-lg transition-colors"
          >
            🎙 Talk to Athena
          </Link>
          <Link
            href="/calls/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Call
          </Link>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {!calls?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No calls recorded yet.{" "}
            <Link href="/calls/new" className="text-blue-400 hover:underline">
              Record one →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
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
                  className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-5 py-3">
                    {(call.jobs as any)?.job_number ? (
                      <Link
                        href={`/jobs/${call.job_id}`}
                        className="text-blue-400 hover:underline font-mono text-xs"
                      >
                        {(call.jobs as any).job_number}
                      </Link>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-200 max-w-xs truncate">
                    {call.ai_summary ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-zinc-400 text-xs capitalize">
                    {(call.jobs as any)?.type ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">
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
