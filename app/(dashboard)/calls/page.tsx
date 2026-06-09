import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { PageShell, Glass, EmptyState } from "@/components/ui/Glass";

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
    <PageShell
      eyebrow="Intake"
      title="Calls"
      subtitle="AI-transcribed intake calls"
      action={
        <div className="flex gap-2">
          <Link
            href="/calls/simulate"
            className="px-4 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm font-medium transition-colors"
          >
            🎙 Talk to Athena
          </Link>
          <Link
            href="/calls/new"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-medium shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:opacity-95 transition-opacity"
          >
            + New Call
          </Link>
        </div>
      }
      width="wide"
    >
      {!calls?.length ? (
        <EmptyState icon="📞" title="No calls recorded yet.">
          <Link href="/calls/new" className="text-[#A6B8E7] hover:text-white transition-colors">
            Record one →
          </Link>
        </EmptyState>
      ) : (
        <Glass className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
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
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-5 py-3">
                    {(call.jobs as any)?.job_number ? (
                      <Link
                        href={`/jobs/${call.job_id}`}
                        className="text-[#A6B8E7] hover:text-white font-mono text-xs transition-colors"
                      >
                        {(call.jobs as any).job_number}
                      </Link>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-white/80 max-w-xs truncate">
                    {call.ai_summary ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-white/45 text-xs capitalize">
                    {(call.jobs as any)?.type ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-white/40 text-xs">
                    {new Date(call.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      )}
    </PageShell>
  );
}
