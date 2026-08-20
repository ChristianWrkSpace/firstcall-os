import { createAdminClient } from "@/lib/supabase-server";

type EventKind =
  | "job_created"
  | "audit"
  | "notification_sent"
  | "legal_doc_created"
  | "legal_doc_sent"
  | "legal_doc_signed"
  | "moisture_reading"
  | "equipment_deployed"
  | "equipment_retrieved"
  | "estimate_created"
  | "estimate_approved"
  | "invoice_created"
  | "invoice_sent"
  | "payment_received";

interface TimelineEvent {
  at: string;             // ISO timestamp
  kind: EventKind;
  icon: string;
  title: string;
  detail?: string;
  actor?: string | null;  // "Office", "Tech", "System", etc.
}

const KIND_COLOR: Record<EventKind, string> = {
  job_created: "border-info/50 bg-blue-500/5",
  audit: "border-edge2 bg-tint",
  notification_sent: "border-purple-500/40 bg-purple-500/5",
  legal_doc_created: "border-yellow-500/40 bg-yellow-500/5",
  legal_doc_sent: "border-info/40 bg-blue-500/5",
  legal_doc_signed: "border-green-500/40 bg-green-500/5",
  moisture_reading: "border-cyan-500/40 bg-cyan-500/5",
  equipment_deployed: "border-orange-500/40 bg-orange-500/5",
  equipment_retrieved: "border-edge2 bg-tint",
  estimate_created: "border-purple-500/40 bg-purple-500/5",
  estimate_approved: "border-green-500/40 bg-green-500/5",
  invoice_created: "border-info/40 bg-blue-500/5",
  invoice_sent: "border-info/40 bg-blue-500/5",
  payment_received: "border-green-500/40 bg-green-500/5",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aob: "Assignment of Benefits",
  work_authorization: "Work Authorization",
  direction_to_pay: "Direction to Pay",
  demand_letter: "Demand Letter",
  notice_of_appraisal: "Notice of Appraisal",
  drying_certificate: "Drying Certificate",
};

const EQUIP_TYPE_LABELS: Record<string, string> = {
  lgr_dehumidifier: "LGR Dehu",
  conventional_dehumidifier: "Conv. Dehu",
  air_mover: "Air Mover",
  air_scrubber: "Air Scrubber",
  extractor: "Extractor",
  other: "Equipment",
};

export default async function JobActivityTimeline({ jobId }: { jobId: string }) {
  const admin = createAdminClient();

  const [
    { data: job },
    { data: notifications },
    { data: legalDocs },
    { data: moistureReadings },
    { data: equipmentAssignments },
    { data: estimates },
    { data: invoices },
    { data: payments },
    { data: auditLogs },
  ] = await Promise.all([
    admin.from("jobs").select("created_at").eq("id", jobId).maybeSingle(),
    admin
      .from("customer_notifications")
      .select("event_type, sent_at, sent_to")
      .eq("job_id", jobId),
    admin
      .from("legal_documents")
      .select("doc_type, created_at, sent_at, signed_at, signed_by_name, sent_to")
      .eq("job_id", jobId),
    admin
      .from("moisture_readings")
      .select("reading_date, room, moisture_pct, is_dry_standard, recorder:profiles!recorded_by(name)")
      .eq("job_id", jobId)
      .order("reading_date", { ascending: false })
      .limit(20),
    admin
      .from("equipment_assignments")
      .select(
        "deployed_at, retrieved_at, deployed_by:profiles!deployed_by(name), retrieved_by:profiles!retrieved_by(name), equipment:equipment_id(type, serial_number)"
      )
      .eq("job_id", jobId),
    admin
      .from("estimates")
      .select("version, status, created_at, approved_at")
      .eq("job_id", jobId),
    admin
      .from("invoices")
      .select("id, invoice_number, status, created_at, sent_at, sent_to, payments(amount, created_at)")
      .eq("job_id", jobId),
    admin
      .from("payments")
      .select("amount, created_at, invoice_id, invoices!inner(job_id)")
      .eq("invoices.job_id", jobId),
    admin
      .from("audit_logs")
      .select("action, created_at, user_name, details")
      .eq("entity_id", jobId)
      .limit(50),
  ]);

  const events: TimelineEvent[] = [];

  if (job?.created_at) {
    events.push({
      at: job.created_at,
      kind: "job_created",
      icon: "🚨",
      title: "Job created",
      detail: "Customer and loss information captured.",
      actor: "System",
    });
  }

  for (const n of (notifications ?? []) as any[]) {
    if (!n.sent_at) continue;
    events.push({
      at: n.sent_at,
      kind: "notification_sent",
      icon: "📧",
      title: `Customer email: ${n.event_type.replace(/_/g, " ")}`,
      detail: `Sent to ${n.sent_to ?? "customer"}`,
      actor: "System",
    });
  }

  for (const d of (legalDocs ?? []) as any[]) {
    const docLabel = DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type;
    if (d.created_at) {
      events.push({
        at: d.created_at,
        kind: "legal_doc_created",
        icon: "⚖️",
        title: `${docLabel} drafted`,
        detail: "Draft created and awaiting approval.",
        actor: "System",
      });
    }
    if (d.sent_at) {
      events.push({
        at: d.sent_at,
        kind: "legal_doc_sent",
        icon: "📤",
        title: `${docLabel} sent`,
        detail: d.sent_to ? `To ${d.sent_to}` : undefined,
        actor: "Office",
      });
    }
    if (d.signed_at) {
      events.push({
        at: d.signed_at,
        kind: "legal_doc_signed",
        icon: "✍️",
        title: `${docLabel} signed`,
        detail: d.signed_by_name ? `Signed by ${d.signed_by_name}` : undefined,
        actor: "Customer",
      });
    }
  }

  for (const r of (moistureReadings ?? []) as any[]) {
    if (!r.reading_date) continue;
    const recorderName = Array.isArray(r.recorder)
      ? r.recorder[0]?.name
      : r.recorder?.name;
    events.push({
      at: r.reading_date,
      kind: "moisture_reading",
      icon: "💧",
      title: `Moisture reading: ${r.room ?? "—"}`,
      detail: `${r.moisture_pct ?? "—"}% MC${r.is_dry_standard ? " · at dry standard ✓" : ""}`,
      actor: recorderName ?? "Tech",
    });
  }

  for (const a of (equipmentAssignments ?? []) as any[]) {
    const eq = Array.isArray(a.equipment) ? a.equipment[0] : a.equipment;
    const eqLabel = eq?.type
      ? `${EQUIP_TYPE_LABELS[eq.type] ?? eq.type} (SN ${eq.serial_number})`
      : "Equipment";
    if (a.deployed_at) {
      const deployer = Array.isArray(a.deployed_by)
        ? a.deployed_by[0]?.name
        : a.deployed_by?.name;
      events.push({
        at: a.deployed_at,
        kind: "equipment_deployed",
        icon: "🛠",
        title: `Deployed: ${eqLabel}`,
        actor: deployer ?? "Tech",
      });
    }
    if (a.retrieved_at) {
      const retriever = Array.isArray(a.retrieved_by)
        ? a.retrieved_by[0]?.name
        : a.retrieved_by?.name;
      events.push({
        at: a.retrieved_at,
        kind: "equipment_retrieved",
        icon: "↩",
        title: `Retrieved: ${eqLabel}`,
        actor: retriever ?? "Tech",
      });
    }
  }

  for (const e of (estimates ?? []) as any[]) {
    if (e.created_at) {
      events.push({
        at: e.created_at,
        kind: "estimate_created",
        icon: "💵",
        title: `Estimate v${e.version} drafted`,
        actor: "Ledger",
      });
    }
    if (e.approved_at) {
      events.push({
        at: e.approved_at,
        kind: "estimate_approved",
        icon: "✅",
        title: `Estimate v${e.version} approved`,
        actor: "Office",
      });
    }
  }

  for (const inv of (invoices ?? []) as any[]) {
    if (inv.created_at) {
      events.push({
        at: inv.created_at,
        kind: "invoice_created",
        icon: "🧾",
        title: `Invoice ${inv.invoice_number} drafted`,
        actor: "Abacus",
      });
    }
    if (inv.sent_at) {
      events.push({
        at: inv.sent_at,
        kind: "invoice_sent",
        icon: "📤",
        title: `Invoice ${inv.invoice_number} sent`,
        detail: inv.sent_to ?? undefined,
        actor: "Office",
      });
    }
  }

  for (const p of (payments ?? []) as any[]) {
    if (p.created_at) {
      events.push({
        at: p.created_at,
        kind: "payment_received",
        icon: "💰",
        title: `Payment received`,
        detail: `$${Number(p.amount ?? 0).toFixed(2)}`,
        actor: "Stripe / Office",
      });
    }
  }

  for (const a of (auditLogs ?? []) as any[]) {
    if (!a.created_at) continue;
    // Skip noisy / duplicate-of-other-event types
    if (a.action.startsWith("legal_doc.")) continue;
    if (a.action === "drying_cert_audit") continue;
    events.push({
      at: a.created_at,
      kind: "audit",
      icon: "📜",
      title: a.action.replace(/[._]/g, " "),
      actor: a.user_name ?? "System",
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (events.length === 0) {
    return (
      <p className="text-ink-3 text-sm italic px-2 py-3">
        No activity logged yet for this job.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 max-h-[460px] overflow-y-auto pr-1">
      {events.map((e, i) => (
        <li
          key={i}
          className={`border rounded-lg px-3 py-2 ${KIND_COLOR[e.kind]}`}
        >
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0 leading-none mt-0.5">{e.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-ink text-sm font-medium capitalize">
                  {e.title}
                </p>
                <p className="text-ink-3 text-[10px] font-mono shrink-0">
                  {fmtDate(e.at)}
                </p>
              </div>
              {e.detail && (
                <p className="text-ink-2 text-xs mt-0.5">{e.detail}</p>
              )}
              {e.actor && (
                <p className="text-ink-3 text-[10px] mt-0.5">by {e.actor}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
