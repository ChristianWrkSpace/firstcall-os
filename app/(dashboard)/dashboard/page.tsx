import { createServerSupabaseClient } from "@/lib/supabase";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: activeJobs },
    { count: openLeads },
    { count: customers },
    { count: callsToday },
    { data: recentJobs },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .neq("status", "completed")
      .neq("status", "cancelled"),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "lead"),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    supabase
      .from("jobs")
      .select("*, customers(name)")
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    { label: "Active Jobs", value: activeJobs ?? 0, href: "/jobs" },
    { label: "Open Leads", value: openLeads ?? 0, href: "/jobs" },
    { label: "Customers", value: customers ?? 0, href: "/customers" },
    { label: "Calls Today", value: callsToday ?? 0, href: "/calls" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors group"
          >
            <p className="text-zinc-400 text-sm">{stat.label}</p>
            <p className="text-3xl font-bold text-white mt-1 group-hover:text-blue-400 transition-colors">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold">Active Jobs</h2>
          <Link href="/jobs" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            View all →
          </Link>
        </div>

        {!recentJobs?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No active jobs.{" "}
            <Link href="/jobs/new" className="text-blue-400 hover:underline">
              Create one →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {recentJobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link href={`/jobs/${job.id}`} className="text-blue-400 hover:underline font-mono text-xs">
                      {job.job_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-white">{(job.customers as any)?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs capitalize">{job.type}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">
                    {new Date(job.created_at).toLocaleDateString()}
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
