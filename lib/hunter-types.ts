// Client-safe constants and types for Hunter (B2B outreach).
// AI calls live in lib/hunter.ts (server-only — imports anthropic).

export type BusinessType =
  | "hotel"
  | "property_management"
  | "plumber"
  | "insurance_office"
  | "restaurant"
  | "medical_facility"
  | "school"
  | "retail"
  | "office_building"
  | "other";

interface BusinessTypeMeta {
  label: string;
  pitch: string;
}

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeMeta> = {
  hotel: {
    label: "Hotel",
    pitch:
      "Guest displacement is revenue lost — we can be on-site within 60 minutes for water emergencies, minimize room downtime.",
  },
  property_management: {
    label: "Property Management",
    pitch:
      "Minimize tenant disruption, smooth insurance claim coordination, single point of contact across your portfolio.",
  },
  plumber: {
    label: "Plumber",
    pitch:
      "Your customer needs immediate water mitigation after the fix — we handle drying so your repair sticks. Referral fees available.",
  },
  insurance_office: {
    label: "Insurance Office",
    pitch:
      "We work directly with adjusters, no scope surprises, IICRC-compliant scopes that hold up to review.",
  },
  restaurant: {
    label: "Restaurant",
    pitch:
      "Hood fires, grease leaks, slip risk after water damage — we're licensed for commercial kitchens, work off-hours to avoid disruption.",
  },
  medical_facility: {
    label: "Medical Facility",
    pitch:
      "OSHA + HIPAA compliant containment, biohazard certification, rapid response to keep facilities operational.",
  },
  school: {
    label: "School / K-12",
    pitch:
      "Summer-break + overnight responsiveness, bonded + insured for K-12 contracts, deal directly with district facilities.",
  },
  retail: {
    label: "Retail",
    pitch:
      "Minimize storefront downtime, off-hours work available, COIs on file for landlord requirements.",
  },
  office_building: {
    label: "Office Building",
    pitch:
      "After-hours work, suite-level isolation, COIs on file, single point of contact for property managers.",
  },
  other: {
    label: "Other",
    pitch: "24/7 emergency response, IICRC-certified, insurance-direct billing.",
  },
};
