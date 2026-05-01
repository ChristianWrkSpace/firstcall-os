// Partner taxonomy + investment categories. Client-safe constants.

export type PartnerType =
  | "plumber"
  | "property_manager"
  | "hotel"
  | "restaurant"
  | "medical_facility"
  | "school"
  | "retail"
  | "office_building"
  | "general_contractor"
  | "insurance_office"
  | "insurance_adjuster"
  | "other";

export const PARTNER_TYPES: Array<{ value: PartnerType; label: string }> = [
  { value: "plumber", label: "Plumber" },
  { value: "property_manager", label: "Property Manager" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "medical_facility", label: "Medical Facility" },
  { value: "school", label: "School" },
  { value: "retail", label: "Retail" },
  { value: "office_building", label: "Office Building" },
  { value: "general_contractor", label: "General Contractor" },
  { value: "insurance_office", label: "Insurance Office" },
  { value: "insurance_adjuster", label: "Insurance Adjuster" },
  { value: "other", label: "Other" },
];

/**
 * Investment logging is forbidden for insurance adjusters. TX Insurance Code
 * § 4102.158 makes "paying anything of value to a public adjuster for
 * referring claims" a real liability. Hide the investment + payout UI for
 * adjusters; allow them as a partner record so attribution still works.
 */
export const NO_INVESTMENT_TYPES: PartnerType[] = ["insurance_adjuster"];

export function canLogInvestmentFor(type: PartnerType | string | null | undefined): boolean {
  if (!type) return true; // unknown defaults to allowed
  return !NO_INVESTMENT_TYPES.includes(type as PartnerType);
}

export type InvestmentCategory =
  | "gift"
  | "meal"
  | "event"
  | "marketing_coop"
  | "training"
  | "other";

export const INVESTMENT_CATEGORIES: Array<{ value: InvestmentCategory; label: string }> = [
  { value: "gift", label: "Gift" },
  { value: "meal", label: "Meal" },
  { value: "event", label: "Event" },
  { value: "marketing_coop", label: "Marketing Co-op" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

export type PayoutMethod = "check" | "ach" | "cash" | "venmo" | "zelle" | "other";

export const PAYOUT_METHODS: Array<{ value: PayoutMethod; label: string }> = [
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH / Wire" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "other", label: "Other" },
];

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = PARTNER_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<PartnerType, string>
);
