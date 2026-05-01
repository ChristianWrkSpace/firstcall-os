// Esquire — Legal & Compliance Agent
// Client-safe constants. NO Anthropic / NO supabase-server imports here.
// (Following the lib/hunter-types.ts split pattern so client components don't
// pull the AI SDK into the browser bundle.)

export type LegalDocType =
  | "aob"
  | "direction_to_pay"
  | "work_authorization"
  | "demand_letter"
  | "notice_of_appraisal"
  | "drying_certificate";

export type LegalDocStatus =
  | "draft"
  | "approved"
  | "sent"
  | "signed"
  | "void";

export const LEGAL_DOC_TYPES: Array<{
  value: LegalDocType;
  label: string;
  short: string;
  description: string;
  whenToUse: string;
  needsSignature: boolean;
  needsRecipient: boolean;
}> = [
  {
    value: "aob",
    label: "Assignment of Benefits (AOB)",
    short: "AOB",
    description:
      "Homeowner assigns insurance proceeds directly to First Call Mitigation. Standard before insurance work.",
    whenToUse:
      "Generate at intake. Have customer sign before mitigation begins.",
    needsSignature: true,
    needsRecipient: false,
  },
  {
    value: "direction_to_pay",
    label: "Direction to Pay",
    short: "Direction to Pay",
    description:
      "Less binding than AOB — homeowner directs the carrier to issue payment to FCM, but doesn't assign rights.",
    whenToUse:
      "When a customer is uncomfortable with full assignment but still wants the carrier to pay us directly.",
    needsSignature: true,
    needsRecipient: false,
  },
  {
    value: "work_authorization",
    label: "Work Authorization",
    short: "Work Auth",
    description:
      "Homeowner authorizes FCM to perform emergency mitigation work and acknowledges scope, access, and hold-harmless terms.",
    whenToUse:
      "Always — sign before any work begins. Required for IICRC compliance and to bill for emergency mitigation.",
    needsSignature: true,
    needsRecipient: false,
  },
  {
    value: "demand_letter",
    label: "Demand Letter (TX § 542.058)",
    short: "Demand Letter",
    description:
      "Formal demand for payment citing Tex. Ins. Code § 542.058 (prompt-pay law). Sent to carrier when payment is overdue.",
    whenToUse:
      "When a carrier is past the 60-day prompt-pay deadline. Triggers statutory interest + attorney fees exposure.",
    needsSignature: false,
    needsRecipient: true,
  },
  {
    value: "notice_of_appraisal",
    label: "Notice of Appraisal",
    short: "Appraisal",
    description:
      "Invokes the appraisal clause when there is a dispute over scope or amount of loss.",
    whenToUse:
      "When the carrier's estimate is materially below ours and negotiation has stalled.",
    needsSignature: false,
    needsRecipient: true,
  },
  {
    value: "drying_certificate",
    label: "Certificate of Dry Standard (IICRC S500)",
    short: "Drying Certificate",
    description:
      "Certifies that all affected materials reached dry standard per IICRC S500. Pulls moisture readings automatically.",
    whenToUse:
      "After final moisture readings confirm dry standard. Required for closeout + insurance approval.",
    needsSignature: true,
    needsRecipient: false,
  },
];

export const LEGAL_DOC_BY_VALUE: Record<
  LegalDocType,
  (typeof LEGAL_DOC_TYPES)[number]
> = LEGAL_DOC_TYPES.reduce(
  (acc, d) => ({ ...acc, [d.value]: d }),
  {} as Record<LegalDocType, (typeof LEGAL_DOC_TYPES)[number]>
);

export const LEGAL_STATUS_BADGE: Record<LegalDocStatus, string> = {
  draft:    "bg-zinc-700 text-zinc-300",
  approved: "bg-blue-500/15 text-blue-400",
  sent:     "bg-purple-500/15 text-purple-300",
  signed:   "bg-green-500/15 text-green-400",
  void:     "bg-zinc-800 text-zinc-500",
};
