import { getCurrentUser } from "@/lib/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import { STATUS_COLORS } from "@/lib/constants";
import { redirect } from "next/navigation";
import Link from "next/link";
import SearchTrigger from "../SearchTrigger";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["lead", "inspection", "mitigation", "drying", "reconstruction"];
const BUSINESS_TIME_ZONE = "America/Chicago";
const businessDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function OperationsHomePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();
  const now = new Date();
  const todayKey = businessDate.format(now);
  // Pull a deliberately broad UTC window, then apply the Austin business-day
  // filter in JS. This stays correct across CST/CDT daylight-saving changes.
  const scheduleWindowStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const scheduleWindowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  let activeJobsQuery = supabase
    .from("jobs")
    .select("id, job_number, status, type, scheduled_at, site_address, site_city, updated_at, customers(name, phone)", { count: "exact" })
    .in("status", ACTIVE_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (cutoff) activeJobsQuery = activeJobsQuery.gte("created_at", cutoff);

  let invoicesQuery = supabase
    .from("invoices")
    .select("id, status, sent_at, line_items:invoice_line_items(line_total), payments(amount)")
    .not("sent_at", "is", null)
    .neq("status", "void");
  if (cutoff) invoicesQuery = invoicesQuery.gte("created_at", cutoff);

  const [
    { data: activeJobs, count: activeJobsCount },
    { data: scheduledCandidates },
    { data: invoices },
    { data: pendingApprovals },
    { count: unsignedDocumentsCount },
  ] = await Promise.all([
    activeJobsQuery,
    supabase
      .from("jobs")
      .select("id, job_number, scheduled_at, site_address, site_city, customers(name, phone)")
      .gte("scheduled_at", scheduleWindowStart.toISOString())
      .lte("scheduled_at", scheduleWindowEnd.toISOString())
      .in("status", ACTIVE_STATUSES)
      .order("scheduled_at", { ascending: true }),
    invoicesQuery,
    supabase
      .from("pending_approvals")
      .select("id, title, detail, link, job_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("legal_documents")
      .select("id", { count: "exact", head: true })
      .is("signed_at", null)
      .in("status", ["draft", "approved", "sent"]),
  ]);

  const scheduledToday = (scheduledCandidates ?? []).filter(
    (job: any) => job.scheduled_at && businessDate.format(new Date(job.scheduled_at)) === todayKey
  );

  const receivables = (invoices ?? []).reduce((sum, invoice: any) => {
    const total = (invoice.line_items ?? []).reduce(
      (lineSum: number, line: any) => lineSum + Number(line.line_total ?? 0),
      0
    );
    const paid = (invoice.payments ?? []).reduce(
      (paymentSum: number, payment: any) => paymentSum + Number(payment.amount ?? 0),
      0
    );
    return sum + Math.max(0, total - paid);
  }, 0);

  const attention = [
    ...(pendingApprovals ?? []).map((item: any) => ({
      id: `approval-${item.id}`,
      title: item.title,
      detail: item.detail || "Review and finish this item.",
      href: item.link || (item.job_id ? `/jobs/${item.job_id}` : "/approvals"),
    })),
    ...(receivables > 0
      ? [{ id: "receivables", title: `${money.format(receivables)} still to collect`, detail: "Review sent invoices and record payments.", href: "/ar" }]
      : []),
    ...((unsignedDocumentsCount ?? 0) > 0
      ? [{ id: "paperwork", title: `${unsignedDocumentsCount ?? 0} documents need completion`, detail: "Review drafts, sends, and missing signatures.", href: "/documents" }]
      : []),
  ].slice(0, 6);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-7">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Operations</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mt-1">
              Good {dayPart()}, {me.name?.split(" ")[0] ?? "there"}.
            </h1>
            <p className="text-sm text-ink-2 mt-1">Here is what the business needs today.</p>
          </div>
          <Link href="/jobs/new" className="inline-flex min-h-11 items-center rounded-xl bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta-deep transition-colors">
            + New job
          </Link>
        </header>

        <div className="max-w-2xl">
          <SearchTrigger variant="command-center" />
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Active jobs" value={String(activeJobsCount ?? 0)} href="/jobs" />
          <Metric label="Scheduled today" value={String(scheduledToday?.length ?? 0)} href="/schedule" />
          <Metric label="To collect" value={money.format(receivables)} href="/ar" warn={receivables > 0} />
          <Metric label="Open paperwork" value={String(unsignedDocumentsCount ?? 0)} href="/documents" warn={(unsignedDocumentsCount ?? 0) > 0} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <section className="lg:col-span-3 glass-card p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-ink">Active jobs</h2>
                <p className="text-xs text-ink-3 mt-0.5">Recently updated</p>
              </div>
              <Link href="/jobs" className="text-sm text-info-deep hover:underline">View all</Link>
            </div>
            {!activeJobs?.length ? (
              <EmptyState text="No active jobs." href="/jobs/new" action="Create a job" />
            ) : (
              <div className="divide-y divide-edge2">
                {activeJobs.slice(0, 8).map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-ink truncate">{job.customers?.name ?? "No customer"}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[job.status] ?? "bg-tint text-ink-3"}`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-xs text-ink-3 mt-1 truncate">
                        {job.job_number} · {[job.site_address, job.site_city].filter(Boolean).join(", ") || "Address needed"}
                      </p>
                    </div>
                    <span className="text-ink-3 group-hover:translate-x-0.5 transition-transform">›</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-2 glass-card p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-ink">Needs attention</h2>
                <p className="text-xs text-ink-3 mt-0.5">Only items requiring a decision</p>
              </div>
              <span className="rounded-full bg-honey/10 px-2 py-0.5 text-[10px] font-semibold text-honey">{attention.length}</span>
            </div>
            {attention.length === 0 ? (
              <div className="rounded-xl bg-pine/5 border border-pine/10 px-4 py-5 text-sm text-pine">✓ Nothing urgent right now.</div>
            ) : (
              <div className="space-y-2">
                {attention.map((item) => (
                  <Link key={item.id} href={item.href} className="block rounded-xl border border-edge2 bg-shade/45 p-3 hover:bg-shade transition-colors">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-ink-3 mt-1 line-clamp-2">{item.detail}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-ink">Today&apos;s schedule</h2>
              <p className="text-xs text-ink-3 mt-0.5">Appointments and dispatch</p>
            </div>
            <Link href="/schedule" className="text-sm text-info-deep hover:underline">Open schedule</Link>
          </div>
          {!scheduledToday?.length ? (
            <div className="glass-card px-5 py-8 text-center text-sm text-ink-3">Nothing scheduled today.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {scheduledToday.map((job: any) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="glass-card p-4 hover:border-[#D97757]/30 transition-colors">
                  <p className="font-mono text-sm font-semibold text-cta-deep">
                    {new Date(job.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE })}
                  </p>
                  <p className="font-medium text-ink mt-2">{job.customers?.name ?? "No customer"}</p>
                  <p className="text-xs text-ink-3 mt-1 truncate">{[job.site_address, job.site_city].filter(Boolean).join(", ") || "Address needed"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction href="/calls/new" label="Log a call" />
          <QuickAction href="/documents" label="Review paperwork" />
          <QuickAction href="/expenses" label="Add an expense" />
          <QuickAction href="/reports" label="View reports" />
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, href, warn = false }: { label: string; value: string; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="glass-card p-4 block hover:border-[#D97757]/30 transition-colors">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className={`text-xl md:text-2xl font-semibold mt-2 tabular-nums ${warn ? "text-honey" : "text-ink"}`}>{value}</p>
    </Link>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="min-h-12 rounded-xl border border-edge2 bg-card px-3 py-3 text-center text-sm font-medium text-ink hover:bg-shade transition-colors">{label}</Link>;
}

function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="rounded-xl bg-shade/45 px-4 py-8 text-center"><p className="text-sm text-ink-3">{text}</p><Link href={href} className="inline-block text-sm text-info-deep mt-2 hover:underline">{action} →</Link></div>;
}

function dayPart() {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date()).find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? 12);
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
