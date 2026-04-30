import { createServerSupabaseClient } from "@/lib/supabase-server";
import { STATUS_COLORS } from "@/lib/constants";
import Link from "next/link";

export default async function JobsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, customers(name, phone)")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{jobs?.length ?? 0} total</p>
        </div>
        <Link
          href="/jobs/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Job
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Job #", "Customer", "Type", "Status", "Site", "Created"].map((h) => (
                <th key={h} className="text-left text-zinc-400 font-medium px-4 py-3 text-xs uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!jobs?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  No jobs yet.{" "}
                  <Link href="/jobs/new" className="text-blue-400 hover:underline">
                    Create your first job →
                  </Link>
                </td>
              </tr>
            )}
            {jobs?.map((job) => (
              <tr
                key={job.id}
                className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-blue-400 hover:underline font-mono text-xs"
                  >
                    {job.job_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white">{(job.customers as any)?.name ?? "—"}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{(job.customers as any)?.phone ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300 capitalize">{job.type ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {[job.site_address, job.site_city].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {new Date(job.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
