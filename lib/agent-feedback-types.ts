export type Agent =
  | "argus"
  | "ledger"
  | "esquire"
  | "solomon"
  | "hunter"
  | "extract"
  | "abacus"
  | "echo";

export type Outcome =
  | "approved_unchanged"
  | "approved_with_edits"
  | "rejected"
  | "revised"
  | "corrected";

/** Pure approval-kind mapping. Kept separate from server-only persistence. */
export function kindToAgentTask(
  kind: string
): { agent: Agent; task: string } | null {
  switch (kind) {
    case "estimate_draft":
      return { agent: "ledger", task: "estimate_draft" };
    case "legal_doc_draft":
      return { agent: "esquire", task: "legal_doc_draft" };
    case "drying_cert_draft":
      return { agent: "esquire", task: "drying_cert_draft" };
    case "demand_letter_draft":
      return { agent: "esquire", task: "demand_letter_draft" };
    case "invoice_draft":
      return { agent: "abacus", task: "invoice_draft" };
    case "status_suggestion":
      return { agent: "echo", task: "status_suggestion" };
    case "referral_attribution":
      return { agent: "echo", task: "referral_attribution" };
    default:
      return null;
  }
}
