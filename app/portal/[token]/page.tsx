import { createAdminClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { hashBearerToken } from "@/lib/token-hash";
import Logo from "@/components/Logo";
import PayInvoiceButton from "./PayInvoiceButton";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "We've received your call", color: "bg-info/10 text-info" },
  inspection: { label: "Inspection completed", color: "bg-honey/10 text-honey" },
  mitigation: { label: "Mitigation in progress", color: "bg-orange-500/15 text-orange-700" },
  drying: { label: "Drying phase — equipment running", color: "bg-purple-500/15 text-violet-700" },
  reconstruction: { label: "Reconstruction underway", color: "bg-indigo-500/15 text-indigo-700" },
  completed: { label: "Work complete", color: "bg-pine/10 text-pine" },
  cancelled: { label: "Job cancelled", color: "bg-shade text-ink-2" },
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
      "id, job_number, status, type, description, created_at, scheduled_at, site_address, site_city, site_state, site_zip, payment_route, deductible_amount, customers(name, insurance_company, insurance_claim_number)"
    )
    .eq("customer_share_token_hash", hashBearerToken(token))
    .gt("customer_share_expires_at", new Date().toISOString())
    .single();

  if (!job) notFound();

  const customer = (job as any).customers;

  // Pull only customer-friendly things — no internal pricing, scope details, partner info
  const [
    { data: photos },
    { data: signedDocs },
    { data: notifications },
    { data: openInvoices },
    { data: signedLegalDocs },
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
    // Permanent record of legal docs the customer has signed or received
    admin
      .from("legal_documents")
      .select("id, doc_type, status, signed_at, signed_by_name, sent_at")
      .eq("job_id", job.id)
      .in("doc_type", [
        "aob",
        "work_authorization",
        "direction_to_pay",
        "drying_certificate",
      ])
      .in("status", ["sent", "signed"])
      .order("created_at", { ascending: false }),
  ]);

  const paymentRoute = (job as any).payment_route ?? "customer_pay";
  const deductible =
    (job as any).deductible_amount != null
      ? Number((job as any).deductible_amount)
      : null;

  // Compute unpaid balance per invoice. For deductible routes, the customer's
  // share is capped at the deductible (less anything they've already paid).
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
      const fullBalance = total - paid;
      let payable = fullBalance;
      if (paymentRoute === "insurance_with_deductible" && deductible != null) {
        payable = Math.max(0, Math.min(fullBalance, deductible - paid));
      } else if (paymentRoute === "insurance_primary") {
        payable = 0;
      }
      return {
        ...inv,
        total,
        paid,
        balance: fullBalance,
        payable,
      };
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
    <div className="min-h-screen app-backdrop">
      {/* Header */}
      <header
        className="bg-card border-b border-edge2 px-6 pb-5"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Logo variant="banner" size={36} priority />
            <p className="text-ink-3 text-xs">Customer Portal</p>
          </div>
          <div className="text-right">
            <p className="text-ink-3 text-xs uppercase tracking-wide">
              Job #
            </p>
            <p className="text-ink font-mono text-sm">{job.job_number}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">
            Hi {customer?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-ink-2 text-sm mt-1">
            Here's the latest on the work at{" "}
            <span className="text-ink">{job.site_address ?? "your property"}</span>.
          </p>
        </div>

        {/* Status */}
        <section className="bg-card border border-edge2 rounded-xl p-6 mb-5">
          <p className="text-ink-3 text-xs uppercase tracking-wide font-semibold mb-2">
            Current Status
          </p>
          <div
            className={`inline-flex px-3 py-1.5 rounded-full text-sm font-semibold ${statusInfo.color}`}
          >
            {statusInfo.label}
          </div>

          {/* Stage tracker */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2 text-[10px] text-ink-3 uppercase tracking-wide">
              {STAGES.slice(0, 6).map((s, i) => (
                <span
                  key={s}
                  className={
                    i <= currentStage ? "text-info font-medium" : "text-ink-3"
                  }
                >
                  {s === "reconstruction" ? "recon" : s}
                </span>
              ))}
            </div>
            <div className="relative h-2 bg-shade rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-green-500 transition-all"
                style={{
                  width: `${currentStage >= 0 ? ((currentStage + 1) / STAGES.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {scheduled && (
            <div className="mt-5 pt-4 border-t border-edge2">
              <p className="text-ink-3 text-xs uppercase tracking-wide mb-1">
                Next Visit
              </p>
              <p className="text-ink text-sm font-medium">{scheduled}</p>
            </div>
          )}
        </section>

        {/* Insurance-primary: no Pay button, just status */}
        {paymentRoute === "insurance_primary" && unpaidInvoices.length > 0 && (
          <section className="bg-card border border-blue-500/30 rounded-xl p-6 mb-5">
            <p className="text-info text-xs uppercase tracking-wide font-semibold mb-3">
              🏛️ Insurance Claim
            </p>
            <p className="text-ink text-sm">
              Your insurance carrier
              {customer?.insurance_company ? (
                <> (<span className="text-ink">{customer.insurance_company}</span>)</>
              ) : null}{" "}
              is being billed directly. You don't owe anything out of pocket for
              this work.
            </p>
            {customer?.insurance_claim_number && (
              <p className="text-ink-3 text-xs mt-3 font-mono">
                Claim #{customer.insurance_claim_number}
              </p>
            )}
          </section>
        )}

        {/* Customer-pay or insurance-with-deductible: show Pay button */}
        {(paymentRoute === "customer_pay" ||
          paymentRoute === "insurance_with_deductible") &&
          unpaidInvoices.length > 0 && (
            <section className="bg-card border border-blue-500/30 rounded-xl p-6 mb-5">
              <p className="text-info text-xs uppercase tracking-wide font-semibold mb-3">
                {paymentRoute === "insurance_with_deductible"
                  ? "💳 Pay Your Deductible"
                  : "💳 Pay Your Invoice"}
              </p>
              {paymentRoute === "insurance_with_deductible" && (
                <p className="text-ink-2 text-xs mb-4">
                  Your insurance is covering the bulk of this claim. The amount
                  below is your deductible — that's all you owe.
                </p>
              )}
              <div className="flex flex-col gap-3">
                {unpaidInvoices.map((inv: any) => {
                  const payable = Number(inv.payable ?? inv.balance);
                  const alreadySettled = payable <= 0;
                  return (
                    <div
                      key={inv.id}
                      className="bg-shade border border-edge2/50 rounded-lg p-4"
                    >
                      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                        <p className="text-ink text-sm font-mono">
                          {inv.invoice_number}
                        </p>
                        <p className="text-2xl font-bold text-ink font-mono">
                          $
                          {payable.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      {inv.due_date && (
                        <p className="text-ink-3 text-xs mb-3">
                          Due {new Date(inv.due_date).toLocaleDateString()}
                        </p>
                      )}
                      {alreadySettled ? (
                        <p className="text-pine text-xs font-medium">
                          ✓ Your portion is paid. Awaiting insurance settlement.
                        </p>
                      ) : (
                        <PayInvoiceButton
                          invoiceId={inv.id}
                          customerToken={token}
                          amount={payable}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        {/* Site Photos */}
        {photoUrls.length > 0 && (
          <section className="bg-card border border-edge2 rounded-xl p-6 mb-5">
            <p className="text-ink-3 text-xs uppercase tracking-wide font-semibold mb-3">
              Site Photos
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="aspect-square bg-shade rounded overflow-hidden"
                >
                  <img
                    src={p.url}
                    alt=""
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
            <p className="text-ink-3 text-[10px] mt-2 italic">
              Tap any photo to view full-size.
            </p>
          </section>
        )}

        {/* Legal Documents — auto-drafted + e-signed via /sign */}
        {(signedLegalDocs?.length ?? 0) > 0 && (
          <section className="bg-card border border-edge2 rounded-xl p-6 mb-5">
            <p className="text-ink-3 text-xs uppercase tracking-wide font-semibold mb-3">
              Legal Documents
            </p>
            <ul className="flex flex-col gap-2">
              {signedLegalDocs!.map((d: any) => {
                const labels: Record<string, string> = {
                  aob: "Assignment of Benefits",
                  direction_to_pay: "Direction to Pay",
                  work_authorization: "Work Authorization",
                  drying_certificate: "Drying Certificate",
                };
                const isSigned = d.status === "signed";
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between bg-shade rounded-lg px-3 py-2.5 text-sm gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-ink">
                        {labels[d.doc_type] ?? d.doc_type}
                      </p>
                      <p className="text-ink-3 text-[10px]">
                        {isSigned
                          ? `Signed by ${d.signed_by_name ?? "you"} ${new Date(d.signed_at).toLocaleDateString()}`
                          : `Sent ${new Date(d.sent_at).toLocaleDateString()} — sign using the secure link delivered to you`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Other signed documents (uploaded paper docs) */}
        {(signedDocs?.length ?? 0) > 0 && (
          <section className="bg-card border border-edge2 rounded-xl p-6 mb-5">
            <p className="text-ink-3 text-xs uppercase tracking-wide font-semibold mb-3">
              Other Signed Documents
            </p>
            <ul className="flex flex-col gap-2">
              {signedDocs!.map((d: any) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between bg-shade rounded-lg px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate">{d.filename}</p>
                    <p className="text-ink-3 text-[10px]">
                      Signed {new Date(d.signed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-pine/10 text-pine text-[10px] rounded font-semibold uppercase">
                    ✓ Signed
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Activity */}
        {(notifications?.length ?? 0) > 0 && (
          <section className="bg-card border border-edge2 rounded-xl p-6 mb-5">
            <p className="text-ink-3 text-xs uppercase tracking-wide font-semibold mb-3">
              Recent Updates
            </p>
            <ul className="flex flex-col gap-2">
              {notifications!.map((n: any, i: number) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-ink-2 truncate">
                    {n.subject ?? n.event_type}
                  </span>
                  <span className="text-ink-3 text-xs whitespace-nowrap">
                    {new Date(n.sent_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Contact */}
        <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 mt-5 text-center">
          <p className="text-ink font-semibold mb-1">Questions or concerns?</p>
          <p className="text-ink-2 text-sm">
            Call us anytime — we're available 24/7 for emergencies and same-day
            response.
          </p>
        </section>

        <footer className="mt-8 text-center text-ink-3 text-xs">
          First Call Mitigation · Austin, TX · IICRC Certified
        </footer>
      </main>
    </div>
  );
}
