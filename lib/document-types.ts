// Restoration-business document taxonomy.
// Categories grouped by where the doc lives in the workflow.

export type DocType =
  | "aob"
  | "direction_to_pay"
  | "customer_authorization"
  | "coi"
  | "insurance_policy"
  | "adjuster_correspondence"
  | "carrier_scope"
  | "drying_certificate"
  | "final_report"
  | "permit"
  | "lien_waiver"
  | "subcontractor_agreement"
  | "w9"
  | "before_after_photos"
  | "other";

export type DocCategory =
  | "Customer Authorizations"
  | "Insurance"
  | "Mitigation Records"
  | "Compliance"
  | "Misc";

export interface DocTypeMeta {
  label: string;
  category: DocCategory;
  description: string;
  emoji: string;
  // If true, the office should track whether this doc has been signed.
  trackSignature?: boolean;
  // If true, this is a "critical" doc — flagged in required-docs checklist.
  required?: boolean;
}

export const DOC_TYPE_META: Record<DocType, DocTypeMeta> = {
  aob: {
    label: "Assignment of Benefits (AOB)",
    category: "Customer Authorizations",
    description: "Customer assigns insurance proceeds rights to First Call.",
    emoji: "✍️",
    trackSignature: true,
    required: true,
  },
  direction_to_pay: {
    label: "Direction to Pay",
    category: "Customer Authorizations",
    description: "Customer authorizes carrier to pay First Call directly.",
    emoji: "💸",
    trackSignature: true,
    required: true,
  },
  customer_authorization: {
    label: "Authorization to Perform Work",
    category: "Customer Authorizations",
    description: "Customer signs off on First Call performing the mitigation.",
    emoji: "📝",
    trackSignature: true,
    required: true,
  },
  coi: {
    label: "Certificate of Insurance (COI)",
    category: "Insurance",
    description: "Proof First Call is insured/bonded — for property managers, commercial.",
    emoji: "🛡",
  },
  insurance_policy: {
    label: "Customer's Insurance Policy",
    category: "Insurance",
    description: "Declarations page from the customer's homeowners policy.",
    emoji: "📄",
  },
  adjuster_correspondence: {
    label: "Adjuster Correspondence",
    category: "Insurance",
    description: "Emails, letters, supplements approved/denied.",
    emoji: "📧",
  },
  carrier_scope: {
    label: "Carrier Scope / Estimate",
    category: "Insurance",
    description: "Scope sheet or estimate prepared by the carrier's adjuster.",
    emoji: "📋",
  },
  drying_certificate: {
    label: "Certificate of Mitigation / Drying",
    category: "Mitigation Records",
    description: "IICRC-style certificate showing materials dried to standard.",
    emoji: "🌡",
  },
  final_report: {
    label: "Final Mitigation Report",
    category: "Mitigation Records",
    description: "Comprehensive scope, work performed, moisture readings.",
    emoji: "📑",
  },
  before_after_photos: {
    label: "Before / During / After Photo Set",
    category: "Mitigation Records",
    description: "Curated photo deliverable for the carrier (separate from Argus working photos).",
    emoji: "📸",
  },
  permit: {
    label: "Building Permit",
    category: "Compliance",
    description: "City of Austin permits for any reconstruction work.",
    emoji: "🏛",
  },
  lien_waiver: {
    label: "Lien Waiver / Release",
    category: "Compliance",
    description: "Waiver of mechanic's lien rights upon payment.",
    emoji: "⚖️",
  },
  subcontractor_agreement: {
    label: "Subcontractor Agreement / COI",
    category: "Compliance",
    description: "Sub's signed agreement and certificate of insurance.",
    emoji: "🤝",
  },
  w9: {
    label: "W-9",
    category: "Compliance",
    description: "Tax form for vendor onboarding with carriers.",
    emoji: "🧾",
  },
  other: {
    label: "Other",
    category: "Misc",
    description: "Anything that doesn't fit a category above.",
    emoji: "📁",
  },
};

export const CATEGORY_ORDER: DocCategory[] = [
  "Customer Authorizations",
  "Insurance",
  "Mitigation Records",
  "Compliance",
  "Misc",
];

export const REQUIRED_DOC_TYPES: DocType[] = (
  Object.keys(DOC_TYPE_META) as DocType[]
).filter((k) => DOC_TYPE_META[k].required);

export function docTypeMeta(type: string): DocTypeMeta {
  return (DOC_TYPE_META as any)[type] ?? DOC_TYPE_META.other;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isPreviewable(mime?: string | null): "pdf" | "image" | null {
  if (!mime) return null;
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return null;
}
