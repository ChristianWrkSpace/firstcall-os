type LegalDocLite = {
  doc_type: string | null;
  signed_at: string | null;
  status: string | null;
};

type ChecklistInput = {
  job: {
    scope_assessment: unknown;
    dispatch_inputs: Record<string, unknown> | null;
    payment_route: string | null;
    status: string | null;
  };
  photoCount: number;
  legalDocs: LegalDocLite[];
  moistureReadings: Array<{
    room: string | null;
    reading_date: string | null;
    is_dry_standard: boolean | null;
  }>;
  estimateCount: number;
  invoices: { status: string }[];
  equipmentDeployed: number;
};

// Mirrors lib/auto-triggers.ts → autoTriggerOnMoistureReading.
// Drying complete = ≥3 distinct days logged AND every room's most recent
// reading is at dry standard.
function computeDryingState(
  readings: ChecklistInput["moistureReadings"]
): { complete: boolean; daysLogged: number; allRoomsDry: boolean } {
  if (readings.length === 0) {
    return { complete: false, daysLogged: 0, allRoomsDry: false };
  }
  const latestByRoom = new Map<string, { date: string; dry: boolean }>();
  for (const r of readings) {
    if (!r.room || !r.reading_date) continue;
    const cur = latestByRoom.get(r.room);
    if (!cur || r.reading_date >= cur.date) {
      latestByRoom.set(r.room, {
        date: r.reading_date,
        dry: !!r.is_dry_standard,
      });
    }
  }
  const distinctDays = new Set(
    readings.map((r) => r.reading_date).filter(Boolean) as string[]
  );
  const allRoomsDry =
    latestByRoom.size > 0 &&
    Array.from(latestByRoom.values()).every((v) => v.dry);
  return {
    complete: distinctDays.size >= 3 && allRoomsDry,
    daysLogged: distinctDays.size,
    allRoomsDry,
  };
}

type Step = {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
  hint: string;
  anchor?: string;
};

function computeSteps(input: ChecklistInput): Step[] {
  const { job, photoCount, legalDocs, moistureReadings, estimateCount, invoices, equipmentDeployed } = input;
  const workAuth = legalDocs.find((d) => d.doc_type === "work_authorization");
  const dryingCert = legalDocs.find((d) => d.doc_type === "drying_certificate");
  const isInsurance = (job.payment_route ?? "customer_pay") !== "customer_pay";
  const moistureReadingCount = moistureReadings.length;
  const drying = computeDryingState(moistureReadings);

  const dryingHint = drying.complete
    ? "All rooms at target MC across 3+ days. Drying Cert auto-drafted in Paperwork."
    : moistureReadingCount === 0
      ? "Log moisture readings as drying progresses. Auto-completes after 3+ days at target."
      : !drying.allRoomsDry
        ? `${drying.daysLogged} day${drying.daysLogged === 1 ? "" : "s"} logged. Some rooms not yet at target MC.`
        : `All rooms at target — log readings on ${3 - drying.daysLogged} more day${3 - drying.daysLogged === 1 ? "" : "s"} to confirm.`;

  return [
    {
      key: "photos",
      label: "Site photos taken (4+ angles)",
      done: photoCount >= 4,
      required: true,
      hint: "Walk every damaged room, snap at least 4 angles per area. Argus needs them to scope.",
      anchor: "photos-scope",
    },
    {
      key: "scope",
      label: "Damage scope analyzed",
      done: !!job.scope_assessment,
      required: true,
      hint: "Hit Analyze on the photos. Argus generates the IICRC S500 scope + equipment list.",
      anchor: "photos-scope",
    },
    {
      key: "work_auth",
      label: "Customer signed Work Authorization",
      done: !!workAuth?.signed_at,
      required: true,
      hint: workAuth
        ? "Doc exists — send the customer the sign link from Esquire."
        : "Generate a Work Authorization in Esquire, then send for signature.",
      anchor: "paperwork",
    },
    {
      key: "equipment",
      label: "Equipment deployed on site",
      done: equipmentDeployed > 0,
      required: true,
      hint: "Assign equipment from inventory once it's running on site. Tracked in Equipment On Site.",
      anchor: "equipment",
    },
    {
      key: "first_reading",
      label: "First moisture reading logged",
      done: moistureReadingCount >= 1,
      required: true,
      hint: "Record psychrometric readings at the start of drying. Required by IICRC S500.",
      anchor: "moisture",
    },
    {
      key: "drying_complete",
      label: "Drying complete (3+ days at target MC)",
      done: drying.complete,
      required: true,
      hint: dryingHint,
      anchor: "moisture",
    },
    {
      key: "drying_cert",
      label: "Drying Certificate signed",
      done: !!dryingCert?.signed_at,
      required: false,
      hint: drying.complete
        ? "Drying Cert was auto-drafted. Approve & send from Paperwork."
        : "After 3+ days at target MC, Esquire auto-drafts the Drying Certificate.",
      anchor: "paperwork",
    },
    {
      key: "estimate",
      label: "Estimate generated",
      done: estimateCount >= 1,
      required: !isInsurance,
      hint: "Auto-drafted after scope analysis. Approve it in the Estimates section.",
      anchor: "estimates",
    },
    {
      key: "invoice",
      label: "Invoice sent",
      done: invoices.some((i) => i.status !== "draft"),
      required: !isInsurance,
      hint: "Auto-drafted when the estimate is approved.",
      anchor: "invoices",
    },
  ];
}

export default function JobChecklist({ input }: { input: ChecklistInput }) {
  const steps = computeSteps(input);
  const required = steps.filter((s) => s.required);
  const optional = steps.filter((s) => !s.required);
  const requiredDone = required.filter((s) => s.done).length;
  const requiredTotal = required.length;
  const percent = Math.round((requiredDone / requiredTotal) * 100);
  const allRequiredDone = requiredDone === requiredTotal;

  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">{allRequiredDone ? "✅" : "📋"}</span>
          <h2 className="text-white font-semibold">Job Checklist</h2>
        </div>
        <span className="text-zinc-400 text-xs font-mono">
          {requiredDone} of {requiredTotal} required
        </span>
      </div>

      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 ${
            allRequiredDone ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1.5">
        {required.map((s) => (
          <Item key={s.key} step={s} />
        ))}
      </ul>

      {optional.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-zinc-500 text-xs hover:text-zinc-300 transition-colors select-none">
            Optional / contextual ({optional.filter((s) => s.done).length}/
            {optional.length})
          </summary>
          <ul className="flex flex-col gap-1.5 mt-2">
            {optional.map((s) => (
              <Item key={s.key} step={s} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Item({ step }: { step: Step }) {
  const labelClass = step.done
    ? "text-zinc-400"
    : step.required
      ? "text-white"
      : "text-zinc-300";

  const indicator = step.done ? (
    <span className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0 mt-0.5">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="w-3 h-3 text-green-400"
        aria-hidden
      >
        <path
          d="M5 10.5l3 3 7-7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  ) : (
    <span className="w-5 h-5 rounded-full border border-zinc-600 shrink-0 mt-0.5" />
  );

  const inner = (
    <>
      {indicator}
      <span className="flex-1 min-w-0">
        <span className={`text-sm ${labelClass}`}>{step.label}</span>
        {!step.done && (
          <span className="block text-zinc-500 text-xs mt-0.5 leading-relaxed">
            {step.hint}
          </span>
        )}
      </span>
    </>
  );

  if (step.anchor && !step.done) {
    return (
      <li>
        <a
          href={`#${step.anchor}`}
          className="flex items-start gap-2.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-zinc-800/60 transition-colors"
        >
          {inner}
        </a>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2.5 px-2 py-1.5 -mx-2">
      {inner}
    </li>
  );
}
