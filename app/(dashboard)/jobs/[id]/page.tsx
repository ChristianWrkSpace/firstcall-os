import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import StatusSelector from "./StatusSelector";
import AddNoteForm from "./AddNoteForm";
import PhotoUploader from "./PhotoUploader";
import PhotoGallery from "./PhotoGallery";
import AnalyzeButton from "./AnalyzeButton";
import ScopeAssessment from "./ScopeAssessment";
import DispatchInputsForm from "./DispatchInputs";
import GenerateEstimateButton from "./GenerateEstimateButton";
import CustomerNotifications from "./CustomerNotifications";
import DocumentsVault from "./DocumentsVault";
import SchedulingPanel from "./SchedulingPanel";
import CustomerShareCard from "./CustomerShareCard";
import { STATUS_COLORS } from "@/lib/constants";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [
    { data: job },
    { data: notes },
    { data: photos },
    { data: estimates },
    { data: invoices },
    { data: notifications },
    { data: documents },
    { data: assignments },
    { data: availableTechs },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, customers(*)")
      .eq("id", id)
      .single(),
    supabase
      .from("job_notes")
      .select("*, profiles(name)")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("job_photos")
      .select("id, storage_path")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("estimates")
      .select("id, version, status, line_items:estimate_line_items(line_total)")
      .eq("job_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, sent_at, due_date, line_items:invoice_line_items(line_total), payments(amount)"
      )
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_notifications")
      .select("id, event_type, sent_to, subject, sent_at")
      .eq("job_id", id)
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase
      .from("job_documents")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("job_assignments")
      .select("id, profile_id, profiles(id, name)")
      .eq("job_id", id),
    supabase
      .from("profiles")
      .select("id, name, role")
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  if (!job) notFound();

  const customer = job.customers as any;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <Link href="/jobs" className="text-zinc-500 hover:text-white text-sm transition-colors">
            ← Jobs
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white font-mono">{job.job_number}</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
            >
              {job.status}
            </span>
          </div>
          <p className="text-zinc-400 text-sm mt-1 capitalize">
            {job.type} damage · Created {new Date(job.created_at).toLocaleDateString()}
          </p>
        </div>
        <StatusSelector jobId={job.id} currentStatus={job.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Job Info + Notes */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Job Info */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Job Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Site Address" value={job.site_address} />
              <Field
                label="City / State / Zip"
                value={[job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ")}
              />
              <Field label="Type" value={job.type} capitalize />
              <Field
                label="Estimated Value"
                value={job.estimated_value ? `$${Number(job.estimated_value).toLocaleString()}` : undefined}
              />
              {job.description && (
                <div className="col-span-2">
                  <p className="text-zinc-400 text-xs uppercase tracking-wide mb-1">Description</p>
                  <p className="text-zinc-200">{job.description}</p>
                </div>
              )}
            </div>
          </section>

          {/* Argus: Site Photos + Scope */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-white font-semibold">Site Photos & Scope</h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Argus analyzes photos to produce IICRC S500-compliant scope and equipment list.
                </p>
              </div>
              <div className="flex gap-2 items-start flex-wrap">
                {job.scope_assessment && (
                  <Link
                    href={`/jobs/${job.id}/loadout`}
                    className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-sm font-medium rounded-lg transition-colors"
                  >
                    📋 Loadout Sheet
                  </Link>
                )}
                <PhotoUploader jobId={job.id} />
                <AnalyzeButton
                  jobId={job.id}
                  hasPhotos={(photos?.length ?? 0) > 0}
                  hasScope={!!job.scope_assessment}
                />
              </div>
            </div>

            <DispatchInputsForm jobId={job.id} initial={job.dispatch_inputs} />

            <PhotoGallery jobId={job.id} photos={photos ?? []} />

            {job.scope_assessment && (
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <ScopeAssessment
                  scope={job.scope_assessment}
                  analyzedAt={job.scope_analyzed_at}
                />
              </div>
            )}
          </section>

          {/* Ledger: Estimates */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-white font-semibold">Estimates</h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Ledger generates Xactimate-style line items from the Argus scope.
                </p>
              </div>
              <GenerateEstimateButton
                jobId={job.id}
                hasScope={!!job.scope_assessment}
              />
            </div>

            {!estimates?.length ? (
              <p className="text-zinc-500 text-sm italic">
                {job.scope_assessment
                  ? "No estimates yet. Click 'Generate Estimate' to draft one."
                  : "Run Argus scope analysis first, then generate an estimate."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {estimates.map((est: any) => {
                  const total = (est.line_items ?? []).reduce(
                    (s: number, li: any) => s + Number(li.line_total ?? 0),
                    0
                  );
                  const statusColors: Record<string, string> = {
                    draft:    "bg-zinc-700 text-zinc-300",
                    approved: "bg-green-500/15 text-green-400",
                    sent:     "bg-blue-500/15 text-blue-400",
                    rejected: "bg-red-500/15 text-red-400",
                    revised:  "bg-yellow-500/15 text-yellow-400",
                  };
                  return (
                    <Link
                      key={est.id}
                      href={`/jobs/${job.id}/estimates/${est.id}`}
                      className="flex items-center justify-between px-4 py-3 bg-zinc-800/40 border border-zinc-700/50 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-mono text-sm">
                          v{est.version}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[est.status] ?? ""}`}
                        >
                          {est.status}
                        </span>
                        <span className="text-zinc-500 text-xs">
                          {(est.line_items ?? []).length} line items
                        </span>
                      </div>
                      <span className="text-white font-mono font-semibold">
                        ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Documents Vault */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="mb-4">
              <h2 className="text-white font-semibold">Documents</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                AOBs, Direction to Pay, COIs, adjuster correspondence, drying certificates.
              </p>
            </div>
            <DocumentsVault jobId={job.id} documents={documents ?? []} />
          </section>

          {/* Abacus: Invoices */}
          {invoices && invoices.length > 0 && (
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="text-white font-semibold">Invoices</h2>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Abacus tracks billing, payments, and reminders.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {invoices.map((inv: any) => {
                  const total = (inv.line_items ?? []).reduce(
                    (s: number, li: any) => s + Number(li.line_total ?? 0),
                    0
                  );
                  const paid = (inv.payments ?? []).reduce(
                    (s: number, p: any) => s + Number(p.amount),
                    0
                  );
                  const balance = total - paid;
                  const statusColors: Record<string, string> = {
                    draft:   "bg-zinc-700 text-zinc-300",
                    sent:    "bg-blue-500/15 text-blue-400",
                    partial: "bg-yellow-500/15 text-yellow-400",
                    paid:    "bg-green-500/15 text-green-400",
                    overdue: "bg-red-500/15 text-red-400",
                    void:    "bg-zinc-800 text-zinc-500",
                  };
                  return (
                    <Link
                      key={inv.id}
                      href={`/jobs/${job.id}/invoices/${inv.id}`}
                      className="flex items-center justify-between px-4 py-3 bg-zinc-800/40 border border-zinc-700/50 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-mono text-sm">
                          {inv.invoice_number}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[inv.status] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                        {paid > 0 && balance > 0 && (
                          <span className="text-zinc-500 text-xs">
                            ${paid.toFixed(0)} of ${total.toFixed(0)} paid
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono font-semibold ${balance > 0 ? "text-white" : "text-green-400"}`}
                      >
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Notes */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Notes & Activity</h2>
            <AddNoteForm jobId={job.id} />

            {notes && notes.length > 0 && (
              <div className="mt-5 flex flex-col gap-4 border-t border-zinc-800 pt-5">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-zinc-300 text-xs font-medium">
                        {((note.profiles as any)?.name ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-200 text-sm">{note.content}</p>
                      <p className="text-zinc-500 text-xs mt-1">
                        {(note.profiles as any)?.name ?? "Unknown"} ·{" "}
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Customer Info */}
        <div className="flex flex-col gap-5">
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Customer</h2>
            {customer ? (
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Name</p>
                  <p className="text-white font-medium">{customer.name}</p>
                </div>
                {customer.phone && (
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Phone</p>
                    <a href={`tel:${customer.phone}`} className="text-blue-400 hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {customer.email && (
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Email</p>
                    <a href={`mailto:${customer.email}`} className="text-blue-400 hover:underline truncate block">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.insurance_company && (
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Insurance</p>
                    <p className="text-zinc-200">{customer.insurance_company}</p>
                    {customer.insurance_claim_number && (
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Claim: {customer.insurance_claim_number}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No customer linked.</p>
            )}
          </section>

          {/* Scheduling */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="mb-3">
              <h2 className="text-white font-semibold">Schedule & Crew</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Set the appointment time and assign techs.
              </p>
            </div>
            <SchedulingPanel
              jobId={job.id}
              scheduledAt={job.scheduled_at}
              leadTechId={job.lead_tech_id}
              assignments={(assignments ?? []).map((a: any) => ({
                id: a.id,
                profile_id: a.profile_id,
                profiles: Array.isArray(a.profiles) ? a.profiles[0] : a.profiles,
              }))}
              availableTechs={availableTechs ?? []}
            />
          </section>

          {/* Customer Portal Share */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="mb-3">
              <h2 className="text-white font-semibold">Customer Portal</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Share a public link so the customer can track progress, no login.
              </p>
            </div>
            <CustomerShareCard
              jobId={job.id}
              initialToken={job.customer_share_token}
            />
          </section>

          {/* Customer Notifications */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="mb-3">
              <h2 className="text-white font-semibold">Notify Customer</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Branded touchpoints. Reduces "where's the tech?" calls.
              </p>
            </div>
            <CustomerNotifications
              jobId={job.id}
              customerEmail={customer?.email}
              history={notifications ?? []}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-zinc-200 ${capitalize ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
  );
}
