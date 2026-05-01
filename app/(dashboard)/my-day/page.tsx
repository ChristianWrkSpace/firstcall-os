import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";

// "My Day" — field tech home screen.
// Shows the jobs assigned to YOU, sorted by today first.
// Big tap targets, mobile-first. Designed for phone-in-hand on a job site.

export const dynamic = "force-dynamic";

export default async function MyDayPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const admin = createAdminClient();

  // Find every job_assignment row pointing at me, plus jobs where I'm lead_tech_id.
  const [{ data: assigned }, { data: leadOnly }] = await Promise.all([
    admin
      .from("job_assignments")
      .select(
        "job_id, jobs(id, job_number, status, type, scheduled_at, site_address, site_city, lead_tech_id, customers(name, phone))"
      )
      .eq("profile_id", me.id),
    admin
      .from("jobs")
      .select(
        "id, job_number, status, type, scheduled_at, site_address, site_city, lead_tech_id, customers(name, phone)"
      )
      .eq("lead_tech_id", me.id),
  ]);

  // Merge & dedupe
  const byId = new Map<string, any>();
  for (const a of (assigned ?? []) as any[]) {
    if (a.jobs) byId.set(a.jobs.id, a.jobs);
  }
  for (const j of (leadOnly ?? []) as any[]) {
    byId.set(j.id, j);
  }

  // Filter to active jobs only (skip completed/cancelled)
  const active = Array.from(byId.values()).filter(
    (j: any) => !["completed", "cancelled"].includes(j.status)
  );

  // Sort: scheduled first (by date asc), then unscheduled
  active.sort((a: any, b: any) => {
    const aT = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
    const bT = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
    return aT - bT;
  });

  // Bucket by day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 2 * 86400000);

  const todayJobs: any[] = [];
  const tomorrowJobs: any[] = [];
  const laterJobs: any[] = [];
  const unscheduledJobs: any[] = [];

  for (const j of active) {
    if (!j.scheduled_at) {
      unscheduledJobs.push(j);
      continue;
    }
    const d = new Date(j.scheduled_at);
    if (d < tomorrow) todayJobs.push(j);
    else if (d < dayAfter) tomorrowJobs.push(j);
    else laterJobs.push(j);
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">
          Hey {me.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          {todayJobs.length === 0 && tomorrowJobs.length === 0 && laterJobs.length === 0
            ? "Nothing on the schedule."
            : `${todayJobs.length} today · ${tomorrowJobs.length} tomorrow · ${laterJobs.length} upcoming`}
        </p>
      </div>

      {todayJobs.length > 0 && (
        <Section title={`Today · ${dateLabel(today)}`} accent="blue">
          {todayJobs.map((j: any) => (
            <JobCard key={j.id} job={j} />
          ))}
        </Section>
      )}
      {tomorrowJobs.length > 0 && (
        <Section title={`Tomorrow · ${dateLabel(tomorrow)}`}>
          {tomorrowJobs.map((j: any) => (
            <JobCard key={j.id} job={j} />
          ))}
        </Section>
      )}
      {laterJobs.length > 0 && (
        <Section title="Upcoming">
          {laterJobs.map((j: any) => (
            <JobCard key={j.id} job={j} />
          ))}
        </Section>
      )}
      {unscheduledJobs.length > 0 && (
        <Section title="Unscheduled — assigned to you">
          {unscheduledJobs.map((j: any) => (
            <JobCard key={j.id} job={j} />
          ))}
        </Section>
      )}

      {active.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-300 text-base">✓ Nothing assigned to you right now.</p>
          <p className="text-zinc-500 text-sm mt-2">
            Office will assign jobs as they come in.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: "blue";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <p
        className={`text-xs uppercase tracking-wide font-semibold mb-2 ${
          accent === "blue" ? "text-blue-400" : "text-zinc-500"
        }`}
      >
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function JobCard({ job }: { job: any }) {
  const customer = job.customers;
  const time = job.scheduled_at
    ? new Date(job.scheduled_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const fullAddress = [
    job.site_address,
    job.site_city,
    job.site_state,
    job.site_zip,
  ]
    .filter(Boolean)
    .join(", ");
  // Universal maps URL — opens default maps app on iOS (Apple Maps via redirect) + Android
  const mapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;
  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <Link
        href={`/jobs/${job.id}`}
        className="block hover:opacity-90 transition-opacity"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-white font-mono text-sm">{job.job_number}</span>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${STATUS_COLORS[job.status] ?? ""}`}
              >
                {job.status}
              </span>
            </div>
            <p className="text-white text-base mt-1.5 font-medium">
              {customer?.name ?? "(no customer)"}
            </p>
            <p className="text-zinc-400 text-sm mt-0.5">
              {[job.site_address, job.site_city].filter(Boolean).join(", ") ||
                "Address TBD"}
            </p>
            <p className="text-zinc-500 text-xs mt-1.5 capitalize">
              {job.type} damage
            </p>
          </div>
          {time && (
            <div className="text-right shrink-0">
              <p className="text-blue-400 text-base font-semibold whitespace-nowrap">
                {time}
              </p>
            </div>
          )}
        </div>
      </Link>

      {/* Quick actions — explicit per-job. 48pt minimum tap targets for the field. */}
      <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-3 gap-2">
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1.5 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 text-sm font-medium rounded-lg min-h-[48px]"
          >
            🧭 <span>Navigate</span>
          </a>
        ) : (
          <span className="flex items-center justify-center py-3 bg-zinc-800/50 text-zinc-500 text-xs rounded-lg min-h-[48px]">
            No address
          </span>
        )}
        {customer?.phone ? (
          <a
            href={`tel:${customer.phone}`}
            className="flex items-center justify-center gap-1.5 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium rounded-lg min-h-[48px]"
          >
            📞 <span>Call</span>
          </a>
        ) : (
          <span className="flex items-center justify-center py-3 bg-zinc-800/50 text-zinc-500 text-xs rounded-lg min-h-[48px]">
            No phone
          </span>
        )}
        <Link
          href={`/jobs/${job.id}`}
          className="flex items-center justify-center gap-1.5 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 text-sm font-medium rounded-lg min-h-[48px]"
        >
          📸 <span>Open</span>
        </Link>
      </div>
    </article>
  );
}

function dateLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
