export const STATUS_COLORS: Record<string, string> = {
  lead:           "bg-blue-500/20 text-blue-400",
  inspection:     "bg-yellow-500/20 text-yellow-400",
  mitigation:     "bg-orange-500/20 text-orange-400",
  drying:         "bg-purple-500/20 text-purple-400",
  reconstruction: "bg-indigo-500/20 text-indigo-400",
  completed:      "bg-green-500/20 text-green-400",
  cancelled:      "bg-zinc-500/20 text-zinc-400",
};

/**
 * GLASS_STATUS — the Tenebrism status palette. Softer, ring-based pills tuned
 * for the dark glass stage (replaces the heavier zinc/500-weight STATUS_COLORS
 * across re-cut surfaces). One source of truth for job lifecycle color.
 */
export const GLASS_STATUS: Record<string, string> = {
  lead:           "bg-[#6B8AD9]/15 text-[#A6B8E7] ring-[#6B8AD9]/25",
  inspection:     "bg-yellow-400/10 text-yellow-300 ring-yellow-400/20",
  mitigation:     "bg-orange-400/10 text-orange-300 ring-orange-400/20",
  drying:         "bg-purple-400/10 text-purple-300 ring-purple-400/20",
  reconstruction: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/20",
  completed:      "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  cancelled:      "bg-white/5 text-white/50 ring-white/10",
};

/** Fallback pill classes for an unknown status. */
export const GLASS_STATUS_FALLBACK = "bg-white/5 text-white/60 ring-white/10";

/**
 * Phase-aware lighting map — which job-detail panels are LIT for a given
 * lifecycle status. Everything not listed recedes into shadow. Drives the
 * chiaroscuro re-cut of the job page: the moment's work glows, the rest waits.
 */
export const JOB_PHASE_LIT: Record<string, readonly string[]> = {
  lead:           ["customer", "schedule", "photos-scope"],
  inspection:     ["photos-scope", "schedule", "estimates"],
  mitigation:     ["photos-scope", "equipment", "moisture"],
  drying:         ["moisture", "equipment"],
  reconstruction: ["estimates", "invoices", "paperwork"],
  completed:      ["invoices", "paperwork", "pnl"],
  cancelled:      [],
};

export const JOB_STATUSES = [
  "lead",
  "inspection",
  "mitigation",
  "drying",
  "reconstruction",
  "completed",
  "cancelled",
] as const;

export const JOB_TYPES = [
  { value: "water",  label: "Water Damage" },
  { value: "fire",   label: "Fire & Smoke" },
  { value: "mold",   label: "Mold Remediation" },
  { value: "storm",  label: "Storm Damage" },
  { value: "other",  label: "Other" },
] as const;

export type PaymentRoute =
  | "customer_pay"
  | "insurance_primary"
  | "insurance_with_deductible";

export const PAYMENT_ROUTES: Array<{
  value: PaymentRoute;
  label: string;
  short: string;
  description: string;
  badge: string;
}> = [
  {
    value: "customer_pay",
    label: "Customer pays out of pocket",
    short: "Customer-pay",
    description:
      "Homeowner is paying the full bill themselves. Pay Online button stays on.",
    badge: "bg-green-500/15 text-green-300",
  },
  {
    value: "insurance_primary",
    label: "Insurance handles full payment",
    short: "Insurance",
    description:
      "Carrier pays the full claim. No deductible owed. Customer portal hides Pay Online and shows the claim status instead.",
    badge: "bg-blue-500/15 text-blue-300",
  },
  {
    value: "insurance_with_deductible",
    label: "Insurance + customer deductible",
    short: "Insurance + deductible",
    description:
      "Carrier covers the bulk; customer owes a deductible. Pay Online charges only the deductible amount.",
    badge: "bg-purple-500/15 text-purple-300",
  },
];

export const PAYMENT_ROUTE_BY_VALUE: Record<
  PaymentRoute,
  (typeof PAYMENT_ROUTES)[number]
> = PAYMENT_ROUTES.reduce(
  (acc, r) => ({ ...acc, [r.value]: r }),
  {} as Record<PaymentRoute, (typeof PAYMENT_ROUTES)[number]>
);
