import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getDataCutoff } from "@/lib/data-cutoff";
import { redirect } from "next/navigation";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";

// "My Day" — field tech home screen.
// Shows the jobs assigned to YOU, sorted by today first.
// Big tap targets, mobile-first, Daylight palette — built for a phone
// in direct sun on a job site.

export const dynamic = "force-dynamic";

export default async function MyDayPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const admin = createAdminClient();
  const cutoff = getDataCutoff();

  let leadQuery = admin
    .from("jobs")
    .select(
      "id, job_number, status, type, scheduled_at, site_address, site_city, lead_tech_id, is_test, customers(name, phone), created_at"
    )
    .eq("lead_tech_id", me.id);
  if (cutoff) leadQuery = leadQuery.gte("created_at", cutoff);

  // Find every job_assignment row pointing at me, plus jobs where I'm lead_tech_id.
  const [{ data: assigned }, { data: leadOnly }] = await Promise.all([
    admin
      .from("job_assignments")
      .select(
        "job_id, jobs(id, job_number, status, type, scheduled_at, site_address, site_city, lead_tech_id, is_test, created_at, customers(name, phone))"
      )
      .eq("profile_id", me.id),
    leadQuery,
  ]);

  // Merge & dedupe — also drop jobs older than the data cutoff (assignments
  // pulled via the join can predate it).
  const byId = new Map<string, any>();
  for (const a of (assigned ?? []) as any[]) {
    if (a.jobs && !a.jobs.is_test && (!cutoff || a.jobs.created_at >= cutoff)) byId.set(a.jobs.id, a.jobs);
  }
  for (const j of (leadOnly ?? []) as any[]) {
    if (!j.is_test) byId.set(j.id, j);
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">My Day</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 text-ink">
          Hey {me.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-ink-2 text-sm mt-1">
          {todayJobs.length === 0 && tomorrowJobs.length === 0 && laterJobs.length === 0
            ? "Nothing on the schedule."
            : `${todayJobs.length} today · ${tomorrowJobs.length} tomorrow · ${laterJobs.length} upcoming`}
        </p>
      </div>

      {todayJobs.length > 0 && (
        <Section title={`Today · ${dateLabel(today)}`} accent>
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
        <div className="glass-card p-10 text-center">
          <p className="text-ink text-base">✓ Nothing assigned to you right now.</p>
          <p className="text-ink-3 text-sm mt-2">
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
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <p
        className={`text-[10px] uppercase tracking-[0.18em] font-semibold mb-2.5 ${
          accent ? "text-[#C4663F]" : "text-ink-3"
        }`}
      >
        {title}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
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
  const statusClass = STATUS_COLORS[job.status] ?? "bg-tint text-ink-3";
  return (
    <div className="glass-card p-4">
      <Link
        href={`/jobs/${job.id}`}
        className="block hover:opacity-90 transition-opacity"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-ink-3 font-mono text-xs">{job.job_number}</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${statusClass}`}>
                {job.status}
              </span>
            </div>
            <p className="text-ink text-base mt-1.5 font-semibold tracking-tight">
              {customer?.name ?? "(no customer)"}
            </p>
            <p className="text-ink-2 text-sm mt-0.5">
              {[job.site_address, job.site_city].filter(Boolean).join(", ") ||
                "Address TBD"}
            </p>
            <p className="text-ink-3 text-xs mt-1.5 capitalize">
              {job.type} damage
            </p>
          </div>
          {time && (
            <div className="text-right shrink-0">
              <p className="text-[#C4663F] text-base font-semibold whitespace-nowrap font-mono">
                {time}
              </p>
            </div>
          )}
        </div>
      </Link>

      {/* Quick actions — 48pt minimum tap targets for the field */}
      <div className="mt-3 pt-3 border-t border-edge2 grid grid-cols-3 gap-2">
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1.5 py-3 bg-shade hover:bg-edge2 active:bg-edge2 text-ink text-sm font-medium rounded-lg min-h-[48px] border border-edge2 transition-colors"
          >
            🧭 <span>Navigate</span>
          </a>
        ) : (
          <span className="flex items-center justify-center py-3 bg-tint text-ink-3 text-xs rounded-lg min-h-[48px] border border-edge2">
            No address
          </span>
        )}
        {customer?.phone ? (
          <a
            href={`tel:${customer.phone}`}
            className="flex items-center justify-center gap-1.5 py-3 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg min-h-[48px] shadow-[0_4px_14px_-4px_rgba(217,119,87,0.5)] active:opacity-90 transition-all"
          >
            📞 <span>Call</span>
          </a>
        ) : (
          <span className="flex items-center justify-center py-3 bg-tint text-ink-3 text-xs rounded-lg min-h-[48px] border border-edge2">
            No phone
          </span>
        )}
        <Link
          href={`/jobs/${job.id}`}
          className="flex items-center justify-center gap-1.5 py-3 bg-shade hover:bg-edge2 active:bg-edge2 text-ink text-sm font-medium rounded-lg min-h-[48px] border border-edge2 transition-colors"
        >
          📸 <span>Open</span>
        </Link>
      </div>
    </div>
  );
}

function dateLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
