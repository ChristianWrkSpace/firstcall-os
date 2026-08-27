import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import StatusSelector from "./StatusSelector";
import AddNoteForm from "./AddNoteForm";
import VoiceNote from "./VoiceNote";
import PhotoUploader from "./PhotoUploader";
import VideoUploader from "./VideoUploader";
import PhotoGallery from "./PhotoGallery";
import AnalyzeButton from "./AnalyzeButton";
import ScopeAssessment from "./ScopeAssessment";
import DispatchInputsForm from "./DispatchInputs";
import CustomerNotifications from "./CustomerNotifications";
import DocumentsVault from "./DocumentsVault";
import SchedulingPanel from "./SchedulingPanel";
import CustomerShareCard from "./CustomerShareCard";
import AdjusterShareCard from "./AdjusterShareCard";
import AdjusterContactCard from "./AdjusterContactCard";
import MoistureLog from "./MoistureLog";
import PaymentRoutePanel from "./PaymentRoutePanel";
import EsquirePanel from "./EsquirePanel";
import AutoNotifyToggle from "./AutoNotifyToggle";
import AutoPauseToggle from "./AutoPauseToggle";
import JobChecklist from "./JobChecklist";
import JobEquipment from "./JobEquipment";
import DeployEquipmentPicker from "./DeployEquipmentPicker";
import JobActivityTimeline from "./JobActivityTimeline";
import JobPnlCard from "./JobPnlCard";
import JobCostEntries from "./JobCostEntries";
import SubInvoices from "./SubInvoices";
import EditableCustomerCard from "./EditableCustomerCard";
import EditableJobDetailsCard from "./EditableJobDetails";
import ManualBillingAmount from "./ManualBillingAmount";
import OpenActOnHash from "./OpenActOnHash";
import { getCostBasis } from "@/lib/job-pnl";
import { getCurrentUser } from "@/lib/auth-helpers";
import SectionHeader from "@/components/SectionHeader";
import { STATUS_COLORS, PAYMENT_ROUTE_BY_VALUE, type PaymentRoute } from "@/lib/constants";

// Always render fresh — job state changes via auto-triggers, status flips,
// approvals, etc. Caching this would show stale data and cause "click into a
// doc that's already been deleted" 404s.
export const dynamic = "force-dynamic";

/* One practical job file: next steps first, then field work, money,
 * paperwork, people, and the permanent record. Optional automation remains
 * inside the relevant section instead of defining the whole experience. */

const PHASES = ["lead", "inspection", "mitigation", "drying", "reconstruction", "completed"] as const;

function Act({
  id,
  title,
  description,
  accent,
  open,
  children,
}: {
  id: string;
  title: string;
  description: string;
  accent: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group rounded-lg border scroll-mt-24"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}
    >
      <summary className="cursor-pointer list-none select-none flex items-center gap-3 px-4 md:px-5 py-4 min-h-[52px] [&::-webkit-details-marker]:hidden">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </span>
        <span className="hidden sm:inline text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </span>
        <span
          className="ml-auto text-xs shrink-0 transition-transform duration-200 group-open:rotate-90"
          style={{ color: "var(--color-text-muted)" }}
        >
          ▸
        </span>
      </summary>
      <div
        className="px-4 md:px-5 pb-5 pt-5 flex flex-col gap-8 border-t"
        style={{ borderColor: "var(--color-edge)" }}
      >
        {children}
      </div>
    </details>
  );
}

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
    { data: invoices },
    { data: notifications },
    { data: documents },
    { data: assignments },
    { data: availableTechs },
    { data: moistureReadings },
    { data: legalDocs },
    { data: equipmentAssignments },
    { data: availableEquipment },
    { data: laborEntries },
    { data: consumableEntries },
    { data: activeSubs },
    { data: subInvoices },
    costBasis,
    currentUser,
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
      .from("invoices")
      .select(
        "id, invoice_number, status, sent_at, due_date, is_manual_billing, line_items:invoice_line_items(line_total), payments(amount)"
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
    supabase
      .from("moisture_readings")
      .select("*, recorder:profiles!recorded_by(name)")
      .eq("job_id", id)
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("legal_documents")
      .select("id, doc_type, subject, status, created_at, sent_at, signed_at")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("equipment_assignments")
      .select(
        "id, deployed_at, hours_at_deploy, equipment:equipment_id(id, type, serial_number, model, manufacturer)"
      )
      .eq("job_id", id)
      .is("retrieved_at", null)
      .order("deployed_at", { ascending: false }),
    supabase
      .from("equipment")
      .select("id, type, serial_number, model")
      .eq("status", "available")
      .order("type", { ascending: true })
      .order("serial_number", { ascending: true }),
    supabase
      .from("tech_labor_entries")
      .select("id, work_date, hours, hourly_rate, profile_id, profiles(name)")
      .eq("job_id", id)
      .order("work_date", { ascending: false }),
    supabase
      .from("consumables_used")
      .select("id, item, quantity, unit_cost")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subcontractors")
      .select("id, name, trade")
      .eq("active", true)
      .order("name"),
    supabase
      .from("sub_invoices")
      .select("id, invoice_number, invoice_date, amount, paid_at, description, subcontractors(name)")
      .eq("job_id", id)
      .order("invoice_date", { ascending: false }),
    getCostBasis(),
    getCurrentUser(),
  ]);

  if (!job) notFound();

  const customer = job.customers as any;
  const paymentRoute: PaymentRoute = (job.payment_route ?? "customer_pay") as PaymentRoute;
  const routeMeta = PAYMENT_ROUTE_BY_VALUE[paymentRoute];
  const isInsurance = paymentRoute !== "customer_pay";

  const status: string = job.status ?? "lead";
  const phaseIdx = PHASES.indexOf(status as (typeof PHASES)[number]);
  const setupOpen = ["lead", "inspection"].includes(status);
  const fieldOpen = ["mitigation", "drying", "reconstruction"].includes(status);
  const billingOpen = status === "completed";
  const moreOpen = status === "cancelled";

  const fullAddress = [job.site_address, job.site_city, job.site_state, job.site_zip]
    .filter(Boolean)
    .join(", ");
  const mapsHref = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;
  const manualActiveInvoice = (invoices ?? []).find(
    (invoice: any) =>
      invoice.status !== "void" &&
      invoice.is_manual_billing === true
  );

  return (
    <div className="p-4 md:p-8">
      <OpenActOnHash />
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {/* ── Header ── */}
        <div>
          <Link
            href="/jobs"
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--color-text-muted)" }}
          >
            ← Jobs
          </Link>
          <div className="flex items-start justify-between gap-3 flex-wrap mt-2">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="text-2xl font-bold font-mono"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {job.job_number}
                </h1>
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] ?? ""}`}
                >
                  {status}
                </span>
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${routeMeta.badge}`}
                  title={routeMeta.description}
                >
                  {routeMeta.short}
                </span>
              </div>
              <p className="text-sm mt-1 capitalize" style={{ color: "var(--color-text-secondary)" }}>
                {customer?.name ? `${customer.name} · ` : ""}
                {job.type} damage · Created {new Date(job.created_at).toLocaleDateString()}
              </p>
              {/* One-tap field actions — phone first */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {customer?.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-shade"
                    style={{ borderColor: "var(--color-edge)", color: "var(--color-text-secondary)", backgroundColor: "rgba(58,47,38,0.05)" }}
                  >
                    📞 Call {customer.name?.split(" ")[0] ?? "customer"}
                  </a>
                )}
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-shade max-w-full"
                    style={{ borderColor: "var(--color-edge)", color: "var(--color-text-secondary)", backgroundColor: "rgba(58,47,38,0.05)" }}
                  >
                    🧭 <span className="truncate">{job.site_address ?? "Navigate"}</span>
                  </a>
                )}
                {currentUser && ["owner", "manager", "office"].includes(currentUser.role) && (
                  <a
                    href="#billing-amount"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-shade"
                    style={{ borderColor: "var(--color-edge)", color: "var(--color-text-secondary)", backgroundColor: "rgba(58,47,38,0.05)" }}
                  >
                    💵 {job.estimated_value == null
                      ? "Add billing amount"
                      : `$${Number(job.estimated_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </a>
                )}
              </div>
            </div>
            <StatusSelector jobId={job.id} currentStatus={job.status} />
          </div>

          {/* ── Phase rail ── */}
          {status !== "cancelled" && (
            <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1" aria-label="Job phase">
              {PHASES.map((p, i) => {
                const done = phaseIdx >= 0 && i < phaseIdx;
                const current = i === phaseIdx;
                return (
                  <div key={p} className="flex items-center gap-1 shrink-0">
                    {i > 0 && (
                      <span
                        className="w-4 h-px"
                        style={{ backgroundColor: done || current ? "rgba(217,119,87,0.4)" : "var(--color-edge)" }}
                      />
                    )}
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider whitespace-nowrap"
                      style={
                        current
                          ? { backgroundColor: "rgba(217,119,87,0.15)", color: "#D97757", border: "1px solid rgba(217,119,87,0.3)" }
                          : done
                            ? { color: "rgba(217,119,87,0.6)" }
                            : { color: "var(--color-text-muted)" }
                      }
                    >
                      {p}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Next steps stay visible so the user never has to hunt. */}
        <div className="rounded-lg border border-[color:var(--color-attention-edge)]">
          <JobChecklist
            input={{
              job: {
                scope_assessment: job.scope_assessment,
                dispatch_inputs: job.dispatch_inputs as Record<string, unknown> | null,
                payment_route: job.payment_route,
                status: job.status,
              },
              photoCount: photos?.length ?? 0,
              legalDocs: (legalDocs ?? []).map((d: any) => ({
                doc_type: d.doc_type,
                signed_at: d.signed_at,
                status: d.status,
              })),
              moistureReadings: (moistureReadings ?? []).map((r: any) => ({
                room: r.room,
                reading_date: r.reading_date,
                is_dry_standard: r.is_dry_standard,
              })),
              invoices: (invoices ?? []).map((i: any) => ({ status: i.status })),
              equipmentDeployed: equipmentAssignments?.length ?? 0,
            }}
          />
        </div>

        {/* Start with the facts and the appointment. */}
        <Act
          id="act-setup"
          title="Job setup"
          description="customer, loss details, schedule, and crew"
          accent="#44689A"
          open={setupOpen}
        >
          <EditableJobDetailsCard
            jobId={job.id}
            job={{
              type: job.type,
              description: job.description,
              site_address: job.site_address,
              site_city: job.site_city,
              site_state: job.site_state,
              site_zip: job.site_zip,
            }}
          />

          {customer ? (
            <EditableCustomerCard
              jobId={job.id}
              showInsurance={isInsurance}
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                insurance_company: customer.insurance_company,
                insurance_policy_number: customer.insurance_policy_number,
                insurance_claim_number: customer.insurance_claim_number,
              }}
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No customer linked.</p>
          )}

          <div>
            <div className="mb-3">
              <SectionHeader title="Schedule & Crew" hint="Set the appointment and assign the people doing the work." />
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
          </div>
        </Act>

        <Act
          id="act-field"
          title="Field work"
          description="photos, drying logs, and equipment"
          accent="#D97757"
          open={fieldOpen}
        >
          <div id="photos-scope" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <SectionHeader title="Photos & Scope" hint="Document the loss and keep the working scope with the job." />
              <div className="flex gap-2 items-start flex-wrap">
                {job.scope_assessment && (
                  <Link
                    href={`/jobs/${job.id}/loadout`}
                    className="px-4 py-2 border rounded-lg text-sm font-medium transition-colors hover:bg-shade"
                    style={{ borderColor: "var(--color-edge)", color: "var(--color-text-secondary)" }}
                  >
                    Loadout sheet
                  </Link>
                )}
                <PhotoUploader jobId={job.id} />
                <VideoUploader jobId={job.id} />
                <AnalyzeButton
                  jobId={job.id}
                  hasPhotos={(photos?.length ?? 0) > 0}
                  hasScope={!!job.scope_assessment}
                  photoCount={photos?.length ?? 0}
                />
              </div>
            </div>
            <DispatchInputsForm jobId={job.id} initial={job.dispatch_inputs} />
            <PhotoGallery jobId={job.id} photos={photos ?? []} />
            {job.scope_assessment && (
              <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--color-edge)" }}>
                <ScopeAssessment scope={job.scope_assessment} analyzedAt={job.scope_analyzed_at} />
              </div>
            )}
          </div>

          <div id="moisture" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader title="Moisture Readings" hint="Record daily readings until every affected area is dry." />
            </div>
            <MoistureLog jobId={job.id} readings={(moistureReadings ?? []) as any} />
          </div>

          <div id="equipment" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <SectionHeader title="Equipment On Site" hint="Track what is running at this property." />
              <div className="flex items-center gap-3">
                {(equipmentAssignments?.length ?? 0) > 0 && (
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {equipmentAssignments?.length} deployed
                  </span>
                )}
                <DeployEquipmentPicker jobId={job.id} available={availableEquipment ?? []} />
              </div>
            </div>
            <JobEquipment
              assignments={(equipmentAssignments ?? []).map((a: any) => ({
                id: a.id,
                deployed_at: a.deployed_at,
                hours_at_deploy: a.hours_at_deploy,
                equipment: Array.isArray(a.equipment) ? a.equipment[0] : a.equipment,
              }))}
              recommended={(job.scope_assessment as any)?.equipment_needed}
            />
          </div>
        </Act>

        <Act
          id="act-billing"
          title="Billing & paperwork"
          description="amount, invoice, authorization, and files"
          accent="#5B82B8"
          open={billingOpen}
        >
          <span id="act-paperwork" className="sr-only" aria-hidden="true" />
          {currentUser && ["owner", "manager", "office"].includes(currentUser.role) && (
            <ManualBillingAmount
              jobId={job.id}
              initialAmount={job.estimated_value}
              existingInvoiceId={manualActiveInvoice?.id ?? null}
            />
          )}

          <div id="invoices" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader title="Invoices" hint="Open, print, send, and record payments from the invoice." />
            </div>
            {!invoices?.length ? (
              <p className="text-sm italic" style={{ color: "var(--color-text-muted)" }}>
                No invoice yet. Save a billing amount above when the job is ready to bill.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {invoices.map((inv: any) => {
                  const total = (inv.line_items ?? []).reduce(
                    (sum: number, line: any) => sum + Number(line.line_total ?? 0),
                    0
                  );
                  const paid = (inv.payments ?? []).reduce(
                    (sum: number, payment: any) => sum + Number(payment.amount ?? 0),
                    0
                  );
                  const balance = total - paid;
                  const statusColors: Record<string, string> = {
                    draft: "bg-tint text-[color:var(--color-text-secondary)]",
                    sent: "bg-[#5B82B8]/15 text-[#44689A]",
                    partial: "bg-honey/10 text-honey",
                    paid: "bg-pine/10 text-pine",
                    overdue: "bg-red-600/10 text-red-700",
                    void: "bg-tint text-[color:var(--color-text-muted)]",
                  };
                  return (
                    <Link
                      key={inv.id}
                      href={`/jobs/${job.id}/invoices/${inv.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors hover:bg-shade"
                      style={{ backgroundColor: "rgba(58,47,38,0.05)", borderColor: "var(--color-edge)" }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm" style={{ color: "#44689A" }}>{inv.invoice_number}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[inv.status] ?? ""}`}>
                            {inv.status}
                          </span>
                        </div>
                        {paid > 0 && balance > 0 && (
                          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                            ${paid.toFixed(0)} of ${total.toFixed(0)} paid
                          </p>
                        )}
                      </div>
                      <span className="font-mono font-semibold shrink-0" style={{ color: balance > 0 ? "var(--color-text-primary)" : "#2E7D5B" }}>
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div id="paperwork" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader title="Authorizations & Signatures" hint="Create, send, and track documents that need a signature." />
            </div>
            <EsquirePanel
              jobId={job.id}
              existingDocs={(legalDocs ?? []) as any}
              invoices={(invoices ?? []).map((invoice: any) => ({
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                status: invoice.status,
              }))}
            />
            <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--color-edge)" }}>
              <div className="mb-3">
                <SectionHeader title="Uploaded Files" hint="Claim files, reports, receipts, and other records received for this job." />
              </div>
              <DocumentsVault jobId={job.id} documents={documents ?? []} />
            </div>
          </div>
        </Act>

        <Act
          id="act-more"
          title="More & history"
          description="costs, sharing, messages, notes, and activity"
          accent="#8B93A7"
          open={moreOpen}
        >
          <div id="pnl" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader title="Job Costs & P&L" hint="Optional cost tracking and profitability details." />
            </div>
            <JobPnlCard jobId={job.id} />
            <div className="mt-5">
              <JobCostEntries
                jobId={job.id}
                defaultHourlyRate={costBasis.default_hourly_rate}
                techs={(availableTechs ?? []).map((tech: any) => ({ id: tech.id, name: tech.name }))}
                laborEntries={(laborEntries ?? []).map((entry: any) => ({
                  id: entry.id,
                  work_date: entry.work_date,
                  hours: entry.hours,
                  hourly_rate: entry.hourly_rate,
                  profile_id: entry.profile_id,
                  profiles: Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles,
                }))}
                consumableEntries={consumableEntries ?? []}
              />
            </div>
            <div className="mt-5">
              <div className="mb-3">
                <SectionHeader title="Subcontractor Invoices" hint="Outside-company costs attached to this job." />
              </div>
              <SubInvoices
                jobId={job.id}
                subs={(activeSubs ?? []) as any}
                invoices={(subInvoices ?? []).map((invoice: any) => ({
                  ...invoice,
                  subcontractors: Array.isArray(invoice.subcontractors) ? invoice.subcontractors[0] : invoice.subcontractors,
                }))}
              />
            </div>
          </div>

          <div>
            <div className="mb-3">
              <SectionHeader title="Payment Route" hint="Change who pays and the customer deductible when needed." />
            </div>
            <PaymentRoutePanel
              jobId={job.id}
              currentRoute={paymentRoute}
              currentDeductible={job.deductible_amount != null ? Number(job.deductible_amount) : null}
            />
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-edge)" }}>
              <AutoPauseToggle
                jobId={job.id}
                initial={!!(job as any).auto_actions_paused}
                isTest={!!(job as any).is_test}
              />
            </div>
          </div>

          {isInsurance && (
            <div>
              <div className="mb-3">
                <SectionHeader title="Adjuster" hint="Review carrier information and prepare adjuster outreach." />
              </div>
              <AdjusterContactCard
                jobNumber={job.job_number}
                customer={customer ?? {}}
                adjusterToken={null}
                siteAddress={job.site_address}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="mb-3"><SectionHeader title="Customer Portal" hint="Create or manage customer access." /></div>
              <CustomerShareCard
                jobId={job.id}
                initialToken={null}
                hasActiveLink={Boolean((job as any).customer_share_token_hash)}
              />
            </div>
            <div>
              <div className="mb-3"><SectionHeader title="Adjuster Portal" hint="Create or manage adjuster access." /></div>
              <AdjusterShareCard
                jobId={job.id}
                initialToken={null}
                hasActiveLink={Boolean((job as any).adjuster_share_token_hash)}
              />
            </div>
          </div>

          <div>
            <div className="mb-3"><SectionHeader title="Customer Messages" hint="Send an intentional update and review recent delivery history." /></div>
            <CustomerNotifications
              jobId={job.id}
              customerEmail={customer?.email}
              history={notifications ?? []}
            />
            {customer?.id && (
              <AutoNotifyToggle
                customerId={customer.id}
                jobId={job.id}
                initial={customer.auto_notify_emails !== false}
              />
            )}
          </div>

          <div>
            <div className="mb-4"><VoiceNote jobId={job.id} /></div>
            <AddNoteForm jobId={job.id} />
            {notes && notes.length > 0 && (
              <div className="mt-5 flex flex-col gap-4 border-t pt-5" style={{ borderColor: "var(--color-edge)" }}>
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "rgba(58,47,38,0.05)" }}>
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                        {((note.profiles as any)?.name ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{note.content}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        {(note.profiles as any)?.name ?? "Unknown"} · {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div id="timeline" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader title="Activity History" hint="A chronological record of job events, messages, documents, equipment, invoices, and payments." />
            </div>
            <JobActivityTimeline jobId={job.id} />
          </div>
        </Act>
      </div>
    </div>
  );
}
