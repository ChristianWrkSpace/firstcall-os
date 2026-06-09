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
import GenerateEstimateButton from "./GenerateEstimateButton";
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
import EditableCustomerCard from "./EditableCustomerCard";
import EditableJobDetailsCard from "./EditableJobDetails";
import { getCostBasis } from "@/lib/job-pnl";
import { Glass, ShadowSection, PageBackdrop, Band, GlassRow } from "@/components/ui/Glass";
import {
  GLASS_STATUS,
  GLASS_STATUS_FALLBACK,
  JOB_PHASE_LIT,
  PAYMENT_ROUTE_BY_VALUE,
  type PaymentRoute,
} from "@/lib/constants";

// One-line read on what THIS lifecycle moment is for — sets the human's
// intent the second the page opens (the lit sections back it up).
const PHASE_INTENT: Record<string, string> = {
  lead:           "New lead — confirm the customer and get eyes on the damage.",
  inspection:     "Inspection — scope the loss and line up the estimate.",
  mitigation:     "Mitigation in progress — deploy equipment and start drying.",
  drying:         "Drying — log moisture daily until it hits standard.",
  reconstruction: "Reconstruction — bill the work and keep paperwork current.",
  completed:      "Completed — settle invoices and close out the file.",
  cancelled:      "Cancelled — this job is closed.",
};

// Always render fresh — job state changes via auto-triggers, status flips,
// approvals, etc. Caching this would show stale data and cause "click into a
// doc that's already been deleted" 404s.
export const dynamic = "force-dynamic";

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
    { data: moistureReadings },
    { data: legalDocs },
    { data: equipmentAssignments },
    { data: availableEquipment },
    { data: laborEntries },
    { data: consumableEntries },
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
  ]);

  const costBasis = await getCostBasis();


  if (!job) notFound();

  const customer = job.customers as any;
  const paymentRoute: PaymentRoute = (job.payment_route ?? "customer_pay") as PaymentRoute;
  const routeMeta = PAYMENT_ROUTE_BY_VALUE[paymentRoute];
  const isInsurance = paymentRoute !== "customer_pay";

  // Phase-aware lighting — which panels glow open for this lifecycle moment;
  // everything else recedes into the collapsed shadow spine until summoned.
  const lit = JOB_PHASE_LIT[job.status] ?? [];
  const isLit = (id: string) => lit.includes(id);
  const statusPill = GLASS_STATUS[job.status] ?? GLASS_STATUS_FALLBACK;

  return (
    <PageBackdrop>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
          <div className="min-w-0">
            <Link
              href="/jobs"
              className="text-white/40 hover:text-white text-sm transition-colors"
            >
              ← Jobs
            </Link>
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-white/95 font-mono">
                {job.job_number}
              </h1>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ring-1 ${statusPill}`}
              >
                {job.status}
              </span>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ${routeMeta.badge}`}
                title={routeMeta.description}
              >
                {routeMeta.short}
              </span>
            </div>
            <p className="text-white/55 text-sm mt-1.5">
              {PHASE_INTENT[job.status] ?? `${job.type} damage`}
            </p>
            <p className="text-white/30 text-xs mt-0.5 capitalize">
              {job.type} damage · created {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
          <StatusSelector jobId={job.id} currentStatus={job.status} />
        </div>

        {/* NOW — orientation: where this job stands, derived from real state.
            The lit sections downstream are this phase's actual work. */}
        <Band label={`Now · ${job.status}`} hint="where this job stands">
          <Glass className="p-5">
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
                estimateCount: estimates?.length ?? 0,
                invoices: (invoices ?? []).map((i: any) => ({ status: i.status })),
                equipmentDeployed: equipmentAssignments?.length ?? 0,
              }}
            />
          </Glass>
        </Band>

        {/* THE ACTS — the spine, grouped into movements. Lit panels (this
            phase's work) glow open inside their band; the rest sit in shadow,
            collapsed, a click from the light. */}
        <div className="flex flex-col gap-7 mt-7">
          {/* ───────────────────────── The Loss ───────────────────────── */}
          <Band label="The Loss" hint="who, where, what happened">
            <ShadowSection id="customer" title="Customer" emoji="👤" lit={isLit("customer")}>
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
                <p className="text-white/40 text-sm">No customer linked.</p>
              )}
            </ShadowSection>

            <ShadowSection id="details" title="Job Details" emoji="✏️" hint="Fix the address or type after intake.">
              <EditableJobDetailsCard
                jobId={job.id}
                job={{
                  type: job.type,
                  description: job.description,
                  site_address: job.site_address,
                  site_city: job.site_city,
                  site_state: job.site_state,
                  site_zip: job.site_zip,
                  estimated_value: job.estimated_value,
                }}
              />
            </ShadowSection>

            <ShadowSection
              id="photos-scope"
              title="Site Photos & Scope"
              emoji="📸"
              hint="Argus analyzes photos to produce IICRC S500-compliant scope and equipment list."
              lit={isLit("photos-scope")}
            >
              <div className="flex gap-2 items-start flex-wrap mb-4">
                {job.scope_assessment && (
                  <Link
                    href={`/jobs/${job.id}/loadout`}
                    className="px-4 py-2 border border-white/[0.08] hover:bg-white/[0.05] text-white/80 text-sm font-medium rounded-lg transition-colors"
                  >
                    📋 Loadout Sheet
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

              <DispatchInputsForm jobId={job.id} initial={job.dispatch_inputs} />
              <PhotoGallery jobId={job.id} photos={photos ?? []} />

              {job.scope_assessment && (
                <div className="mt-6 pt-6 border-t border-white/[0.06]">
                  <ScopeAssessment scope={job.scope_assessment} analyzedAt={job.scope_analyzed_at} />
                </div>
              )}
            </ShadowSection>
          </Band>

          {/* ───────────────────────── The Work ───────────────────────── */}
          <Band label="The Work" hint="crew, equipment, drying to standard">
            <ShadowSection
              id="schedule"
              title="Schedule & Crew"
              emoji="🗓"
              hint="Set the appointment time and assign techs."
              lit={isLit("schedule")}
            >
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
            </ShadowSection>

            <ShadowSection
              id="equipment"
              title="Equipment On Site"
              emoji="🛠"
              hint="What's currently deployed from your inventory. Compares against Argus's recommended load."
              lit={isLit("equipment")}
              right={
                equipmentAssignments && equipmentAssignments.length > 0 ? (
                  <span className="text-white/40 text-xs">{equipmentAssignments.length} deployed</span>
                ) : undefined
              }
            >
              <div className="mb-4">
                <DeployEquipmentPicker jobId={job.id} available={availableEquipment ?? []} />
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
            </ShadowSection>

            <ShadowSection
              id="moisture"
              title="Moisture Readings"
              emoji="💧"
              hint="Daily psychrometric capture per IICRC S500. Required to certify drying."
              accent="blue"
              lit={isLit("moisture")}
            >
              <MoistureLog jobId={job.id} readings={(moistureReadings ?? []) as any} />
            </ShadowSection>
          </Band>

          {/* ───────────────────────── The Money ──────────────────────── */}
          <Band label="The Money" hint="estimate → invoice → paid">
            <ShadowSection
              id="estimates"
              title="Estimates"
              emoji="🧮"
              hint="Ledger generates Xactimate-style line items from the Argus scope."
              accent="blue"
              lit={isLit("estimates")}
            >
              <div className="mb-4">
                <GenerateEstimateButton jobId={job.id} hasScope={!!job.scope_assessment} />
              </div>
              {!estimates?.length ? (
                <p className="text-white/40 text-sm italic">
                  {job.scope_assessment
                    ? "No estimates yet. Generate one from the Argus scope."
                    : "Run Argus scope analysis first, then generate an estimate."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {estimates.map((est: any) => {
                    const total = (est.line_items ?? []).reduce(
                      (s: number, li: any) => s + Number(li.line_total ?? 0),
                      0
                    );
                    return (
                      <GlassRow
                        key={est.id}
                        href={`/jobs/${job.id}/estimates/${est.id}`}
                        accent="blue"
                        meta={
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ring-1 bg-white/[0.04] text-white/70 ring-white/10">
                            {est.status}
                          </span>
                        }
                        title={
                          <span>
                            <span className="text-[#A6B8E7] font-mono">v{est.version}</span> Estimate
                          </span>
                        }
                        sub={`${(est.line_items ?? []).length} line items`}
                        trailing={
                          <span className="text-white/95 font-mono font-semibold">
                            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </ShadowSection>

            {invoices && invoices.length > 0 && (
              <ShadowSection
                id="invoices"
                title="Invoices"
                emoji="💵"
                hint="Abacus tracks billing, payments, and reminders."
                accent="blue"
                lit={isLit("invoices")}
              >
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
                    return (
                      <GlassRow
                        key={inv.id}
                        href={`/jobs/${job.id}/invoices/${inv.id}`}
                        accent="blue"
                        meta={
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ring-1 bg-white/[0.04] text-white/70 ring-white/10">
                            {inv.status}
                          </span>
                        }
                        title={
                          <span className="text-[#A6B8E7] font-mono">{inv.invoice_number}</span>
                        }
                        sub={paid > 0 && balance > 0 ? `$${paid.toFixed(0)} of $${total.toFixed(0)} paid` : undefined}
                        trailing={
                          <span className={`font-mono font-semibold ${balance > 0 ? "text-white/95" : "text-emerald-300"}`}>
                            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </ShadowSection>
            )}

            <ShadowSection
              id="pnl"
              title="Job P&L"
              emoji="💰"
              hint="Live revenue minus all COGS (labor + consumables + equipment + van). Updates as you log entries. Tune defaults in Settings → Cost Basis."
              accent="blue"
              lit={isLit("pnl")}
            >
              <JobPnlCard jobId={job.id} />
              <div className="mt-5">
                <JobCostEntries
                  jobId={job.id}
                  defaultHourlyRate={costBasis.default_hourly_rate}
                  techs={(availableTechs ?? []).map((t: any) => ({ id: t.id, name: t.name }))}
                  laborEntries={(laborEntries ?? []).map((e: any) => ({
                    id: e.id,
                    work_date: e.work_date,
                    hours: e.hours,
                    hourly_rate: e.hourly_rate,
                    profile_id: e.profile_id,
                    profiles: Array.isArray(e.profiles) ? e.profiles[0] : e.profiles,
                  }))}
                  consumableEntries={consumableEntries ?? []}
                />
              </div>
            </ShadowSection>

            <ShadowSection
              id="payment"
              title="Payment Route"
              emoji="🧾"
              hint="Drives the customer-portal billing UX."
            >
              <PaymentRoutePanel
                jobId={job.id}
                currentRoute={paymentRoute}
                currentDeductible={job.deductible_amount != null ? Number(job.deductible_amount) : null}
              />
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <AutoPauseToggle jobId={job.id} initial={!!(job as any).auto_actions_paused} />
              </div>
            </ShadowSection>
          </Band>

          {/* ──────────────────── People & Paperwork ──────────────────── */}
          <Band label="People & Paperwork" hint="adjuster, portals, documents, touchpoints">
            <ShadowSection
              id="paperwork"
              title="Paperwork"
              emoji="📑"
              hint="Outgoing drafts (AOBs, demand letters, drying certs — Esquire writes, you approve) and incoming uploads (COIs, adjuster correspondence, signed scans)."
              accent="amber"
              lit={isLit("paperwork")}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-white/55 text-xs uppercase tracking-wide font-semibold">⚖️ Esquire-drafted</span>
                <span className="text-white/35 text-[10px]">outgoing</span>
              </div>
              <EsquirePanel
                jobId={job.id}
                existingDocs={(legalDocs ?? []) as any}
                invoices={(invoices ?? []).map((i: any) => ({
                  id: i.id,
                  invoice_number: i.invoice_number,
                  status: i.status,
                }))}
              />
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-white/55 text-xs uppercase tracking-wide font-semibold">📎 Uploaded files</span>
                  <span className="text-white/35 text-[10px]">incoming</span>
                </div>
                <DocumentsVault jobId={job.id} documents={documents ?? []} />
              </div>
            </ShadowSection>

            {isInsurance && (
              <ShadowSection
                id="adjuster"
                title="Contact Adjuster"
                emoji="📞"
                hint="Carrier info + draft outreach for the insurance adjuster."
              >
                <AdjusterContactCard
                  jobNumber={job.job_number}
                  customer={customer ?? {}}
                  adjusterToken={(job as any).adjuster_share_token ?? null}
                  siteAddress={job.site_address}
                />
              </ShadowSection>
            )}

            <ShadowSection
              id="customer-portal"
              title="Customer Portal"
              emoji="🔗"
              hint="Share a public link so the customer can track progress, no login."
            >
              <CustomerShareCard jobId={job.id} initialToken={job.customer_share_token} />
            </ShadowSection>

            <ShadowSection
              id="adjuster-portal"
              title="Adjuster Portal"
              emoji="🔗"
              hint="Read-only claim packet for the insurance adjuster."
            >
              <AdjusterShareCard jobId={job.id} initialToken={(job as any).adjuster_share_token} />
            </ShadowSection>

            <ShadowSection
              id="notify"
              title="Notify Customer"
              emoji="✉️"
              hint={`Branded touchpoints. Reduces "where's the tech?" calls.`}
            >
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
            </ShadowSection>
          </Band>

          {/* ────────────────────────── Record ────────────────────────── */}
          <Band label="Record" hint="every event, every note">
            <ShadowSection
              id="timeline"
              title="Activity Timeline"
              emoji="📜"
              hint="Every event on this job — emails, docs, readings, equipment, estimates, payments — in one chronological feed."
            >
              <JobActivityTimeline jobId={job.id} />
            </ShadowSection>

            <ShadowSection id="notes" title="Notes" emoji="📝" hint="Voice or typed notes from the crew.">
              <div className="mb-4">
                <VoiceNote jobId={job.id} />
              </div>
              <AddNoteForm jobId={job.id} />
              {notes && notes.length > 0 && (
                <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.06] pt-5">
                  {notes.map((note) => (
                    <div key={note.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white/70 text-xs font-medium">
                          {((note.profiles as any)?.name ?? "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-sm">{note.content}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {(note.profiles as any)?.name ?? "Unknown"} ·{" "}
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ShadowSection>
          </Band>
        </div>
      </div>
    </PageBackdrop>
  );
}
