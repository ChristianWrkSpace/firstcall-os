// Daylight palette — soft tinted pills with deep, readable text on cream.
export const STATUS_COLORS: Record<string, string> = {
  lead:           "bg-sky-600/10 text-sky-700",
  inspection:     "bg-amber-500/15 text-amber-700",
  mitigation:     "bg-orange-500/15 text-orange-700",
  drying:         "bg-violet-500/10 text-violet-700",
  reconstruction: "bg-indigo-500/10 text-indigo-700",
  completed:      "bg-emerald-500/10 text-emerald-700",
  cancelled:      "bg-stone-500/10 text-stone-500",
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
    badge: "bg-emerald-500/10 text-emerald-700",
  },
  {
    value: "insurance_primary",
    label: "Insurance handles full payment",
    short: "Insurance",
    description:
      "Carrier pays the full claim. No deductible owed. Customer portal hides Pay Online and shows the claim status instead.",
    badge: "bg-sky-600/10 text-sky-700",
  },
  {
    value: "insurance_with_deductible",
    label: "Insurance + customer deductible",
    short: "Insurance + deductible",
    description:
      "Carrier covers the bulk; customer owes a deductible. Pay Online charges only the deductible amount.",
    badge: "bg-violet-500/10 text-violet-700",
  },
];

export const PAYMENT_ROUTE_BY_VALUE: Record<
  PaymentRoute,
  (typeof PAYMENT_ROUTES)[number]
> = PAYMENT_ROUTES.reduce(
  (acc, r) => ({ ...acc, [r.value]: r }),
  {} as Record<PaymentRoute, (typeof PAYMENT_ROUTES)[number]>
);
