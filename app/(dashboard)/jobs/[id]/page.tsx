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
import OpenActOnHash from "./OpenActOnHash";
import { getCostBasis } from "@/lib/job-pnl";
import SectionHeader from "@/components/SectionHeader";
import { STATUS_COLORS, PAYMENT_ROUTE_BY_VALUE, type PaymentRoute } from "@/lib/constants";

// Always render fresh — job state changes via auto-triggers, status flips,
// approvals, etc. Caching this would show stale data and cause "click into a
// doc that's already been deleted" 404s.
export const dynamic = "force-dynamic";

/* ── The spine ─────────────────────────────────────────────────────────────
 * One calm column. "Needs You" stays lit at the top — the agents' derived
 * next actions. Everything else folds into acts named for the agent that
 * runs them; the act for the job's current phase opens by default. The
 * human scans, taps, approves. The agents do the rest.
 * ────────────────────────────────────────────────────────────────────────*/

const PHASES = ["lead", "inspection", "mitigation", "drying", "reconstruction", "completed"] as const;

function Act({
  id,
  title,
  agent,
  accent,
  open,
  children,
}: {
  id: string;
  title: string;
  agent: string;
  accent: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group rounded-2xl border scroll-mt-24"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}
    >
      <summary className="cursor-pointer list-none select-none flex items-center gap-3 px-4 md:px-5 py-4 min-h-[52px] [&::-webkit-details-marker]:hidden">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </span>
        <span className="hidden sm:inline text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
          {agent}
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

  const status: string = job.status ?? "lead";
  const phaseIdx = PHASES.indexOf(status as (typeof PHASES)[number]);
  const fieldOpen = ["lead", "inspection", "mitigation", "drying", "reconstruction"].includes(status);
  const moneyOpen = status === "completed";
  const recordOpen = status === "cancelled";

  const fullAddress = [job.site_address, job.site_city, job.site_state, job.site_zip]
    .filter(Boolean)
    .join(", ");
  const mapsHref = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;

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
                          ? { backgroundColor: "rgba(217,119,87,0.15)", color: "#D97757", boxShadow: "0 0 0 1px rgba(217,119,87,0.3)" }
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

        {/* ── Needs You — always lit. The agents' derived next actions. ── */}
        <div
          className="rounded-2xl"
          style={{ boxShadow: "0 0 0 1px rgba(245,158,11,0.18), 0 0 32px -16px rgba(245,158,11,0.25)" }}
        >
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
        </div>

        {/* ── Act I: The Field — Argus runs this ── */}
        <Act
          id="act-field"
          title="The Field"
          agent="Argus scopes from photos · you approve"
          accent="#D97757"
          open={fieldOpen}
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
              estimated_value: job.estimated_value,
            }}
          />

          <div id="photos-scope" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <SectionHeader
                title="Site Photos & Scope"
                hint="Argus analyzes photos to produce IICRC S500-compliant scope and equipment list."
              />
              <div className="flex gap-2 items-start flex-wrap">
                {job.scope_assessment && (
                  <Link
                    href={`/jobs/${job.id}/loadout`}
                    className="px-4 py-2 border rounded-lg text-sm font-medium transition-colors hover:bg-shade"
                    style={{ borderColor: "var(--color-edge)", color: "var(--color-text-secondary)" }}
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
            </div>
            <DispatchInputsForm jobId={job.id} initial={job.dispatch_inputs} />
            <PhotoGallery jobId={job.id} photos={photos ?? []} />
            {job.scope_assessment && (
              <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--color-edge)" }}>
                <ScopeAssessment
                  scope={job.scope_assessment}
                  analyzedAt={job.scope_analyzed_at}
                />
              </div>
            )}
          </div>

          <div id="moisture" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader
                title="Moisture Readings"
                emoji="💧"
                hint="Daily psychrometric capture per IICRC S500. Required to certify drying."
              />
            </div>
            <MoistureLog jobId={job.id} readings={(moistureReadings ?? []) as any} />
          </div>

          <div id="equipment" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <SectionHeader
                title="Equipment On Site"
                emoji="🛠"
                hint="What's currently deployed from your inventory. Compares against Argus's recommended load."
              />
              <div className="flex items-center gap-3">
                {equipmentAssignments && equipmentAssignments.length > 0 && (
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {equipmentAssignments.length} deployed
                  </span>
                )}
                <DeployEquipmentPicker
                  jobId={job.id}
                  available={availableEquipment ?? []}
                />
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

        {/* ── Act II: The Money — Ledger drafts, Abacus collects ── */}
        <Act
          id="act-money"
          title="The Money"
          agent="Ledger estimates · Abacus invoices & collects"
          accent="#5B82B8"
          open={moneyOpen}
        >
          <div id="pnl" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader
                title="Job P&L"
                emoji="💰"
                hint="Live revenue minus all COGS (labor + consumables + equipment + van). Updates the moment you log entries below. Tune defaults in Settings → Cost Basis."
              />
            </div>
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
          </div>

          <div id="estimates" className="scroll-mt-24">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <SectionHeader
                title="Estimates"
                hint="Ledger generates Xactimate-style line items from the Argus scope."
              />
              <GenerateEstimateButton
                jobId={job.id}
                hasScope={!!job.scope_assessment}
              />
            </div>
            {!estimates?.length ? (
              <p className="text-sm italic" style={{ color: "var(--color-text-muted)" }}>
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
                    draft:    "bg-tint text-[color:var(--color-text-secondary)]",
                    approved: "bg-pine/10 text-pine",
                    sent:     "bg-[#5B82B8]/15 text-[#44689A]",
                    rejected: "bg-red-600/10 text-red-700",
                    revised:  "bg-honey/10 text-honey",
                  };
                  return (
                    <Link
                      key={est.id}
                      href={`/jobs/${job.id}/estimates/${est.id}`}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-shade"
                      style={{ backgroundColor: "rgba(58,47,38,0.05)", borderColor: "var(--color-edge)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm" style={{ color: "#44689A" }}>
                          v{est.version}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[est.status] ?? ""}`}
                        >
                          {est.status}
                        </span>
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {(est.line_items ?? []).length} line items
                        </span>
                      </div>
                      <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div id="invoices" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader
                title="Invoices"
                hint="Abacus tracks billing, payments, and reminders."
              />
            </div>
            {!invoices?.length ? (
              <p className="text-sm italic" style={{ color: "var(--color-text-muted)" }}>
                No invoices yet — approve an estimate and Abacus drafts one.
              </p>
            ) : (
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
                    draft:   "bg-tint text-[color:var(--color-text-secondary)]",
                    sent:    "bg-[#5B82B8]/15 text-[#44689A]",
                    partial: "bg-honey/10 text-honey",
                    paid:    "bg-pine/10 text-pine",
                    overdue: "bg-red-600/10 text-red-700",
                    void:    "bg-tint text-[color:var(--color-text-muted)]",
                  };
                  return (
                    <Link
                      key={inv.id}
                      href={`/jobs/${job.id}/invoices/${inv.id}`}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-shade"
                      style={{ backgroundColor: "rgba(58,47,38,0.05)", borderColor: "var(--color-edge)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm" style={{ color: "#44689A" }}>
                          {inv.invoice_number}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[inv.status] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                        {paid > 0 && balance > 0 && (
                          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            ${paid.toFixed(0)} of ${total.toFixed(0)} paid
                          </span>
                        )}
                      </div>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: balance > 0 ? "var(--color-text-primary)" : "#2E7D5B" }}
                      >
                        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </Act>

        {/* ── Act III: The Paperwork — Esquire writes, you approve ── */}
        <Act
          id="act-paperwork"
          title="The Paperwork"
          agent="Esquire drafts · you approve before anything sends"
          accent="#C4B5FD"
        >
          <div id="paperwork" className="scroll-mt-24">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                ⚖️ Esquire-drafted
              </span>
              <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>outgoing</span>
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
            <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--color-edge)" }}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  📎 Uploaded files
                </span>
                <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>incoming</span>
              </div>
              <DocumentsVault jobId={job.id} documents={documents ?? []} />
            </div>
          </div>
        </Act>

        {/* ── Act IV: The People — contacts, crew, access ── */}
        <Act
          id="act-people"
          title="The People"
          agent="customer · adjuster · crew · portals"
          accent="#44689A"
        >
          <div>
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
              <>
                <h2 className="font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Customer</h2>
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No customer linked.</p>
              </>
            )}
          </div>

          <div>
            <div className="mb-3">
              <SectionHeader
                title="Payment Route"
                hint="Drives the customer-portal billing UX."
              />
            </div>
            <PaymentRoutePanel
              jobId={job.id}
              currentRoute={paymentRoute}
              currentDeductible={
                job.deductible_amount != null ? Number(job.deductible_amount) : null
              }
            />
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-edge)" }}>
              <AutoPauseToggle
                jobId={job.id}
                initial={!!(job as any).auto_actions_paused}
              />
            </div>
          </div>

          {isInsurance && (
            <div>
              <div className="mb-3">
                <SectionHeader
                  title="Contact Adjuster"
                  hint="Carrier info + draft outreach for the insurance adjuster."
                />
              </div>
              <AdjusterContactCard
                jobNumber={job.job_number}
                customer={customer ?? {}}
                adjusterToken={(job as any).adjuster_share_token ?? null}
                siteAddress={job.site_address}
              />
            </div>
          )}

          <div>
            <div className="mb-3">
              <SectionHeader
                title="Schedule & Crew"
                hint="Set the appointment time and assign techs."
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="mb-3">
                <SectionHeader
                  title="Customer Portal"
                  hint="Share a public link so the customer can track progress, no login."
                />
              </div>
              <CustomerShareCard
                jobId={job.id}
                initialToken={job.customer_share_token}
              />
            </div>
            <div>
              <div className="mb-3">
                <SectionHeader
                  title="Adjuster Portal"
                  hint="Read-only claim packet for the insurance adjuster."
                />
              </div>
              <AdjusterShareCard
                jobId={job.id}
                initialToken={(job as any).adjuster_share_token}
              />
            </div>
          </div>

          <div>
            <div className="mb-3">
              <SectionHeader
                title="Notify Customer"
                hint={`Branded touchpoints. Reduces "where's the tech?" calls.`}
              />
            </div>
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
        </Act>

        {/* ── Act V: The Record — notes & full history ── */}
        <Act
          id="act-record"
          title="The Record"
          agent="every note, event, and email — chronological"
          accent="#8B93A7"
          open={recordOpen}
        >
          <div>
            <div className="mb-4">
              <VoiceNote jobId={job.id} />
            </div>
            <AddNoteForm jobId={job.id} />
            {notes && notes.length > 0 && (
              <div className="mt-5 flex flex-col gap-4 border-t pt-5" style={{ borderColor: "var(--color-edge)" }}>
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: "rgba(58,47,38,0.05)" }}
                    >
                      <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                        {((note.profiles as any)?.name ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{note.content}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        {(note.profiles as any)?.name ?? "Unknown"} ·{" "}
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div id="timeline" className="scroll-mt-24">
            <div className="mb-4">
              <SectionHeader
                title="Activity Timeline"
                emoji="📜"
                hint="Every event on this job — emails sent, docs created/sent/signed, moisture readings, equipment deploy/retrieve, estimates approved, payments received — in one chronological feed."
              />
            </div>
            <JobActivityTimeline jobId={job.id} />
          </div>
        </Act>
      </div>
    </div>
  );
}
