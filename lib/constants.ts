export const STATUS_COLORS: Record<string, string> = {
  lead:           "bg-blue-500/20 text-blue-400",
  inspection:     "bg-yellow-500/20 text-yellow-400",
  mitigation:     "bg-orange-500/20 text-orange-400",
  drying:         "bg-purple-500/20 text-purple-400",
  reconstruction: "bg-indigo-500/20 text-indigo-400",
  completed:      "bg-green-500/20 text-green-400",
  cancelled:      "bg-zinc-500/20 text-zinc-400",
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
