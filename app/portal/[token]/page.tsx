import { createAdminClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import PayInvoiceButton from "./PayInvoiceButton";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "We've received your call", color: "bg-blue-500/15 text-blue-300" },
  inspection: { label: "Inspection completed", color: "bg-yellow-500/15 text-yellow-300" },
  mitigation: { label: "Mitigation in progress", color: "bg-orange-500/15 text-orange-300" },
  drying: { label: "Drying phase — equipment running", color: "bg-purple-500/15 text-purple-300" },
  reconstruction: { label: "Reconstruction underway", color: "bg-indigo-500/15 text-indigo-300" },
  completed: { label: "Work complete", color: "bg-green-500/15 text-green-300" },
  cancelled: { label: "Job cancelled", color: "bg-zinc-700 text-zinc-400" },
};

const STAGES = [
  "lead",
  "inspection",
  "mitigation",
  "drying",
  "reconstruction",
  "completed",
];

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Use admin client because portal users aren't authenticated
  // The token IS the auth — must match exactly
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, job_number, status, type, description, created_at, scheduled_at, site_address, site_city, site_state, site_zip, customers(name)"
    )
    .eq("customer_share_token", token)
    .single();

  if (!job) notFound();

  const customer = (job as any).customers;

  // Pull only customer-friendly things — no internal pricing, scope details, partner info
  const [
    { data: photos },
    { data: signedDocs },
    { data: notifications },
    { data: openInvoices },
  ] = await Promise.all([
    admin
      .from("job_photos")
      .select("id, storage_path")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("job_documents")
      .select("id, doc_type, filename, storage_path, signed, signed_at")
      .eq("job_id", job.id)
      .eq("signed", true)
      .order("created_at", { ascending: false }),
    admin
      .from("customer_notifications")
      .select("event_type, sent_at, subject")
      .eq("job_id", job.id)
      .order("sent_at", { ascending: false })
      .limit(8),
    admin
      .from("invoices")
      .select(
        "id, invoice_number, status, due_date, line_items:invoice_line_items(line_total), payments(amount)"
      )
      .eq("job_id", job.id)
      .in("status", ["sent", "partial", "overdue"])
      .order("created_at", { ascending: false }),
  ]);

  // Compute unpaid balance per invoice
  const unpaidInvoices = (openInvoices ?? [])
    .map((inv: any) => {
      const total = (inv.line_items ?? []).reduce(
        (s: number, li: any) => s + Number(li.line_total ?? 0),
        0
      );
      const paid = (inv.payments ?? []).reduce(
        (s: number, p: any) => s + Number(p.amount),
        0
      );
      return { ...inv, total, paid, balance: total - paid };
    })
    .filter((inv) => inv.balance > 0);

  // Generate signed URLs for photos
  const photoUrls: Array<{ id: string; url: string }> = [];
  for (const p of photos ?? []) {
    const { data } = await admin.storage
      .from("job-photos")
      .createSignedUrl(p.storage_path, 60 * 60);
    if (data) photoUrls.push({ id: p.id, url: data.signedUrl });
  }

  const currentStage = STAGES.indexOf(job.status);
  const statusInfo = STATUS_LABELS[job.status] ?? STATUS_LABELS.lead;

  const scheduled = job.scheduled_at
    ? new Date(job.scheduled_at).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">FC</span>
            </div>
            <div>
              <p className="text-white font-semibold">First Call Mitigation</p>
              <p className="text-zinc-500 text-xs">Customer Portal</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">
              Job #
            </p>
            <p className="text-white font-mono text-sm">{job.job_number}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            Hi {customer?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Here's the latest on the work at{" "}
            <span className="text-zinc-200">{job.site_address ?? "your property"}</span>.
          </p>
        </div>

        {/* Status */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
          <p className="text-zinc-500 text-xs uppercase tracking-wide font-semibold mb-2">
            Current Status
          </p>
          <div
            className={`inline-flex px-3 py-1.5 rounded-full text-sm font-semibold ${statusInfo.color}`}
          >
            {statusInfo.label}
          </div>

          {/* Stage tracker */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2 text-[10px] text-zinc-500 uppercase tracking-wide">
              {STAGES.slice(0, 6).map((s, i) => (
                <span
                  key={s}
                  className={
                    i <= currentStage ? "text-blue-400 font-medium" : "text-zinc-600"
                  }
                >
                  {s === "reconstruction" ? "recon" : s}
                </span>
              ))}
            </div>
            <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-green-500 transition-all"
                style={{
                  width: `${currentStage >= 0 ? ((currentStage + 1) / STAGES.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {scheduled && (
            <div className="mt-5 pt-4 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                Next Visit
              </p>
              <p className="text-white text-sm font-medium">{scheduled}</p>
            </div>
          )}
        </section>

        {/* Unpaid invoices — Pay Online */}
        {unpaidInvoices.length > 0 && (
          <section className="bg-zinc-900 border border-blue-500/30 rounded-xl p-6 mb-5">
            <p className="text-blue-300 text-xs uppercase tracking-wide font-semibold mb-3">
              💳 Pay Your Invoice
            </p>
            <div className="flex flex-col gap-3">
              {unpaidInvoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4"
                >
                  <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                    <p className="text-white text-sm font-mono">
                      {inv.invoice_number}
                    </p>
                    <p className="text-2xl font-bold text-white font-mono">
                      $
                      {inv.balance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  {inv.due_date && (
                    <p className="text-zinc-500 text-xs mb-3">
                      Due {new Date(inv.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <PayInvoiceButton
                    invoiceId={inv.id}
                    customerToken={token}
                    amount={inv.balance}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Site Photos */}
        {photoUrls.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <p className="text-zinc-500 text-xs uppercase tracking-wide font-semibold mb-3">
              Site Photos
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="aspect-square bg-zinc-800 rounded overflow-hidden"
                >
                  <img
                    src={p.url}
                    alt=""
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
            <p className="text-zinc-600 text-[10px] mt-2 italic">
              Tap any photo to view full-size.
            </p>
          </section>
        )}

        {/* Signed Documents */}
        {(signedDocs?.length ?? 0) > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <p className="text-zinc-500 text-xs uppercase tracking-wide font-semibold mb-3">
              Your Signed Documents
            </p>
            <ul className="flex flex-col gap-2">
              {signedDocs!.map((d: any) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{d.filename}</p>
                    <p className="text-zinc-500 text-[10px]">
                      Signed {new Date(d.signed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-[10px] rounded font-semibold uppercase">
                    ✓ Signed
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Activity */}
        {(notifications?.length ?? 0) > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <p className="text-zinc-500 text-xs uppercase tracking-wide font-semibold mb-3">
              Recent Updates
            </p>
            <ul className="flex flex-col gap-2">
              {notifications!.map((n: any, i: number) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-zinc-300 truncate">
                    {n.subject ?? n.event_type}
                  </span>
                  <span className="text-zinc-500 text-xs whitespace-nowrap">
                    {new Date(n.sent_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Contact */}
        <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 mt-5 text-center">
          <p className="text-white font-semibold mb-1">Questions or concerns?</p>
          <p className="text-zinc-400 text-sm">
            Call us anytime — we're available 24/7 for emergencies and same-day
            response.
          </p>
        </section>

        <footer className="mt-8 text-center text-zinc-600 text-xs">
          First Call Mitigation · Austin, TX · IICRC Certified
        </footer>
      </main>
    </div>
  );
}
