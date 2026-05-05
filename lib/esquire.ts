// Esquire — Legal & Compliance Agent (server-only)
// Uses Claude Opus 4.7 with adaptive thinking to draft restoration-industry
// legal documents. Output is ALWAYS a draft. Approval gate is enforced in
// the UI + server actions; this file only generates text.

import { anthropic, MODELS } from "./ai";
import { feedbackPreamble } from "./agent-feedback";
import {
  LEGAL_DOC_BY_VALUE,
  type LegalDocType,
} from "./esquire-types";

export interface JobContext {
  job_number: string;
  type: string | null;
  description: string | null;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_zip: string | null;
  scope_assessment: any | null;
  created_at: string | null;
}

export interface CustomerContext {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  insurance_company?: string | null;
  insurance_policy_number?: string | null;
  insurance_claim_number?: string | null;
}

export interface InvoiceContext {
  invoice_number: string;
  total: number;
  paid: number;
  balance: number;
  sent_at: string | null;
  due_date: string | null;
  days_overdue: number;
}

export interface MoistureContext {
  rooms: string[];
  reading_count: number;
  first_reading_date: string | null;
  last_reading_date: string | null;
  all_dry_standard: boolean;
}

// Note: legal documents are rendered with the company logo banner image at
// the top of the legal doc detail page — no text letterhead needed in the
// body itself anymore.

function siteLine(job: JobContext) {
  return [job.site_address, job.site_city, job.site_state, job.site_zip]
    .filter(Boolean)
    .join(", ");
}

function customerAddressLine(c: CustomerContext) {
  return [c.address, c.city, c.state, c.zip].filter(Boolean).join(", ");
}

function parseSubjectBody(text: string, fallbackSubject: string) {
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)$/i);
  return {
    subject: subjectMatch?.[1]?.trim() ?? fallbackSubject,
    body: bodyMatch?.[1]?.trim() ?? text.trim(),
  };
}

async function callClaude(prompt: string, maxTokens = 2000, task?: string) {
  // Recursive self-learning: pull recent corrections for this doc_type and
  // prepend them so the model learns from prior human edits without retraining.
  const preamble = task ? await feedbackPreamble("esquire", `${task}_draft`, 5) : "";
  const message = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: preamble + prompt }],
    ...({ _agent: "esquire", _task: task ? `${task}_draft` : "legal_doc_draft" } as any),
  } as any);
  return message.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────
// AOB
// ─────────────────────────────────────────────────────────────────────────

export async function generateAOB(job: JobContext, customer: CustomerContext) {
  const prompt = `You are Esquire, the legal-document drafter for First Call Mitigation, an IICRC-certified water/fire/mold restoration company in Austin, Texas. Draft an Assignment of Benefits (AOB) for the homeowner to sign.

JOB
- Job #: ${job.job_number}
- Loss site: ${siteLine(job) || "(address pending)"}
- Loss type: ${job.type ?? "water damage"}
- Description: ${job.description ?? "(none)"}

INSURED / HOMEOWNER
- Name: ${customer.name}
- Mailing: ${customerAddressLine(customer) || "(same as loss site)"}
- Phone: ${customer.phone ?? "(not provided)"}
- Email: ${customer.email ?? "(not provided)"}

INSURANCE
- Carrier: ${customer.insurance_company ?? "(to be filled)"}
- Policy #: ${customer.insurance_policy_number ?? "(to be filled)"}
- Claim #: ${customer.insurance_claim_number ?? "(to be filled)"}

REQUIREMENTS:
- Plain-English, residential-friendly. Not a federal-case treatise.
- Clearly assign to "First Call Mitigation" the right to pursue and receive insurance proceeds for emergency mitigation services performed at the loss site.
- Include: scope of assignment (mitigation only, not full reconstruction unless agreed), revocation rights (TX § 542A.005 if applicable), homeowner obligation to cooperate, hold-harmless language, attorneys' fees clause, governing law (Texas).
- End with a signature block: Homeowner signature + printed name + date, plus FCM representative signature.
- Heading: "ASSIGNMENT OF BENEFITS"
- DO NOT invent specific TX statute citations beyond what's commonly cited (Tex. Ins. Code § 542.058 for prompt-pay context, § 542A for AOB if water-related).
- Keep total length under ~600 words.
- Plain text, no markdown headers — this will print on letterhead. Use ALL-CAPS for section titles like "1. ASSIGNMENT" / "2. REVOCATION" etc.

Begin with the FCM letterhead, then the document. Respond with the document body only — no commentary before or after.`;

  const body = await callClaude(prompt, 2000, "aob");
  return {
    subject: `Assignment of Benefits — ${customer.name} — Job ${job.job_number}`,
    body: body.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Work Authorization
// ─────────────────────────────────────────────────────────────────────────

export async function generateWorkAuthorization(
  job: JobContext,
  customer: CustomerContext
) {
  const prompt = `You are Esquire, the legal-document drafter for First Call Mitigation, an IICRC-certified water/fire/mold restoration company in Austin, Texas. Draft a WORK AUTHORIZATION the homeowner signs before mitigation begins. This is distinct from an AOB — it authorizes FCM to PERFORM the work (access, scope, hold-harmless), not to receive insurance proceeds.

JOB
- Job #: ${job.job_number}
- Loss site: ${siteLine(job) || "(address pending)"}
- Loss type: ${job.type ?? "water damage"}
- Description: ${job.description ?? "(none)"}

HOMEOWNER
- Name: ${customer.name}
- Mailing: ${customerAddressLine(customer) || "(same as loss site)"}
- Phone: ${customer.phone ?? "(not provided)"}

REQUIREMENTS — write a single-page authorization the homeowner signs covering:
1. AUTHORIZATION TO PERFORM WORK — homeowner authorizes FCM to enter the loss site and perform emergency mitigation per IICRC S500/S520 standards (water/mold/fire as applicable).
2. SCOPE — describe the scope as "emergency mitigation including but not limited to water extraction, content manipulation, structural drying, antimicrobial application, controlled demolition of unsalvageable materials, and equipment placement (dehumidifiers, air movers, air scrubbers)." Note that reconstruction is NOT included unless separately authorized.
3. ACCESS — homeowner grants FCM and its subcontractors 24/7 access to the loss site for the duration of mitigation, including for daily moisture readings.
4. EQUIPMENT — homeowner acknowledges drying equipment will run continuously; homeowner is responsible for keeping power on and not unplugging or moving equipment. Replacement-cost liability if removed early.
5. PAYMENT TERMS — homeowner is ultimately responsible for the bill; insurance is between homeowner and carrier (unless an AOB or Direction to Pay is also signed).
6. HOLD-HARMLESS — FCM is held harmless for pre-existing damage, secondary damage from undisclosed conditions, and damage to items inside walls/ceilings that are documented before demolition.
7. CONTROLLED DEMOLITION CONSENT — homeowner consents to limited demolition (drywall flood cuts, baseboard removal, cabinet kick removal, carpet/pad removal) where required to dry the structure, with photos captured before removal.
8. CHANGE ORDERS — any out-of-scope work requires a written change order signed by the homeowner.
9. GOVERNING LAW — Texas; venue Travis County or where loss site is located.
10. SIGNATURE BLOCK — Homeowner signature, printed name, date; FCM representative signature, printed name, title, date.

FORMATTING:
- Heading: "WORK AUTHORIZATION"
- Use ALL-CAPS section titles like "1. AUTHORIZATION TO PERFORM WORK"
- Plain English. ~500 words max. Plain text, no markdown.

Output the authorization body only — no commentary before or after.`;

  const body = await callClaude(prompt, 2000, "work_authorization");
  return {
    subject: `Work Authorization — ${customer.name} — Job ${job.job_number}`,
    body: body.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Direction to Pay
// ─────────────────────────────────────────────────────────────────────────

export async function generateDirectionToPay(
  job: JobContext,
  customer: CustomerContext
) {
  const prompt = `You are Esquire for First Call Mitigation in Austin TX. Draft a Direction to Pay letter for the homeowner to sign — this is LESS binding than an AOB. The homeowner directs the carrier to issue payment to FCM but does NOT assign rights.

JOB
- Job #: ${job.job_number}
- Loss site: ${siteLine(job) || "(address pending)"}

HOMEOWNER
- Name: ${customer.name}
- Phone: ${customer.phone ?? ""}

INSURANCE
- Carrier: ${customer.insurance_company ?? "(to be filled)"}
- Policy #: ${customer.insurance_policy_number ?? "(to be filled)"}
- Claim #: ${customer.insurance_claim_number ?? "(to be filled)"}

REQUIREMENTS:
- Heading: "DIRECTION TO PAY"
- Address it from the homeowner TO the carrier.
- Plainly state: the homeowner directs the carrier to make any insurance proceeds payable to First Call Mitigation for mitigation work performed at the loss site, and to mail/EFT directly to FCM.
- Note that this is a payment direction, not an assignment of rights — homeowner retains rights.
- Signature block: Homeowner + date.
- Plain text. ~250 words max.

Respond with the letter body only.`;

  const body = await callClaude(prompt, 1200, "direction_to_pay");
  return {
    subject: `Direction to Pay — ${customer.name} — Job ${job.job_number}`,
    body: body.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Demand Letter (TX § 542.058 prompt-pay)
// ─────────────────────────────────────────────────────────────────────────

export async function generateDemandLetter(
  job: JobContext,
  customer: CustomerContext,
  invoice: InvoiceContext
) {
  const prompt = `You are Esquire for First Call Mitigation, drafting a FORMAL DEMAND LETTER addressed to the insurance carrier under Texas Insurance Code § 542.058 (prompt-pay law).

CONTEXT
- Carrier: ${customer.insurance_company ?? "(carrier name)"}
- Policy #: ${customer.insurance_policy_number ?? "(policy)"}
- Claim #: ${customer.insurance_claim_number ?? "(claim)"}
- Insured: ${customer.name}
- Loss site: ${siteLine(job) || "(address)"}

INVOICE STATUS
- Invoice #: ${invoice.invoice_number}
- Amount: $${invoice.total.toFixed(2)}
- Paid: $${invoice.paid.toFixed(2)}
- Balance: $${invoice.balance.toFixed(2)}
- Originally sent: ${invoice.sent_at ?? "(date)"}
- Days overdue: ${invoice.days_overdue}

REQUIREMENTS:
- Professional tone — firm, not hostile. Goal is payment, not litigation.
- Heading: "FORMAL DEMAND FOR PAYMENT"
- Cite Tex. Ins. Code § 542.058 (60-day prompt-pay deadline), and § 542.060 (18% statutory interest + attorney's fees on late payment).
- Reference: this is the FCM mitigation work for the insured loss; supporting docs (invoice, scope, photos, moisture log, signed AOB) have been provided previously.
- Demand: payment of the outstanding balance within 30 days, or FCM will pursue all available remedies including statutory interest and attorney's fees.
- Provide carrier with: contact info, claim #, invoice #, amount due, response deadline.
- Signature block: For First Call Mitigation, [Name], [Title].
- Plain text, no markdown. ~350 words max.

Begin with FCM letterhead format. Output the letter body only — no commentary.`;

  const body = await callClaude(prompt, 1500, "demand_letter");
  return {
    subject: `DEMAND FOR PAYMENT — Claim ${customer.insurance_claim_number ?? job.job_number} — Invoice ${invoice.invoice_number}`,
    body: body.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Notice of Appraisal
// ─────────────────────────────────────────────────────────────────────────

export async function generateNoticeOfAppraisal(
  job: JobContext,
  customer: CustomerContext,
  disputeSummary: string
) {
  const prompt = `You are Esquire for First Call Mitigation. Draft a NOTICE OF APPRAISAL invoking the appraisal clause in the homeowner's policy. Sent to the carrier when there is a dispute over scope or amount of loss.

CONTEXT
- Carrier: ${customer.insurance_company ?? "(carrier)"}
- Policy #: ${customer.insurance_policy_number ?? "(policy)"}
- Claim #: ${customer.insurance_claim_number ?? "(claim)"}
- Insured: ${customer.name}
- Loss site: ${siteLine(job) || "(address)"}

DISPUTE
${disputeSummary || "(Carrier's settlement offer is materially below the documented scope of mitigation work performed.)"}

REQUIREMENTS:
- Heading: "NOTICE OF APPRAISAL"
- State that, pursuant to the appraisal provision of the policy, the insured (and FCM as assignee, if AOB on file) demands appraisal to resolve the dispute over the amount of loss.
- Identify the insured's appraiser by placeholder ("[Insured's Appraiser TBD]") so the user fills in.
- State the time frame (typically each party names an appraiser within 20 days; appraisers select an umpire if needed).
- Reference: standard residential policy appraisal language.
- Demand: carrier name its appraiser within 20 days.
- Note that suspending the appraisal process would itself be evidence of bad faith.
- Plain text. ~300 words max.

Output letter body only.`;

  const body = await callClaude(prompt, 1500, "notice_of_appraisal");
  return {
    subject: `Notice of Appraisal — Claim ${customer.insurance_claim_number ?? job.job_number}`,
    body: body.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Drying Certificate (IICRC S500)
// ─────────────────────────────────────────────────────────────────────────

export async function generateDryingCertificate(
  job: JobContext,
  customer: CustomerContext,
  moisture: MoistureContext
) {
  const prompt = `You are Esquire for First Call Mitigation. Draft a CERTIFICATE OF DRY STANDARD certifying that mitigation work has restored affected materials to dry standard per IICRC S500.

JOB
- Job #: ${job.job_number}
- Loss site: ${siteLine(job) || "(address)"}
- Loss type: ${job.type ?? "water damage"}
- Insured: ${customer.name}

DRYING DATA
- Rooms documented: ${moisture.rooms.join(", ") || "(per scope)"}
- Total moisture readings logged: ${moisture.reading_count}
- First reading: ${moisture.first_reading_date ?? "(see log)"}
- Final reading: ${moisture.last_reading_date ?? "(see log)"}
- All affected materials reached dry standard: ${moisture.all_dry_standard ? "YES" : "(verify final readings before signing)"}

REQUIREMENTS:
- Heading: "CERTIFICATE OF DRY STANDARD"
- Subheading referencing IICRC S500-2021 (Standard for Professional Water Damage Restoration)
- Certify: all affected materials at the loss site reached dry standard as established by comparable unaffected materials; psychrometric readings have been logged per S500.
- Note: full moisture log is attached / available on request.
- Sign-off block: IICRC-certified Lead Technician (name + cert # blank) and date.
- Customer acknowledgement signature block.
- Plain text. ~250 words max.

Output certificate body only.`;

  const body = await callClaude(prompt, 1200, "drying_certificate");
  return {
    subject: `Certificate of Dry Standard — Job ${job.job_number}`,
    body: body.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  job: JobContext;
  customer: CustomerContext;
  invoice?: InvoiceContext;
  moisture?: MoistureContext;
  disputeSummary?: string;
}

export async function generateLegalDocByType(
  docType: LegalDocType,
  opts: GenerateOptions
) {
  const meta = LEGAL_DOC_BY_VALUE[docType];
  if (!meta) throw new Error(`Unknown doc type: ${docType}`);

  switch (docType) {
    case "aob":
      return generateAOB(opts.job, opts.customer);
    case "work_authorization":
      return generateWorkAuthorization(opts.job, opts.customer);
    case "direction_to_pay":
      return generateDirectionToPay(opts.job, opts.customer);
    case "demand_letter":
      if (!opts.invoice) {
        throw new Error("Demand letter requires an invoice with overdue balance.");
      }
      return generateDemandLetter(opts.job, opts.customer, opts.invoice);
    case "notice_of_appraisal":
      return generateNoticeOfAppraisal(
        opts.job,
        opts.customer,
        opts.disputeSummary ?? ""
      );
    case "drying_certificate":
      if (!opts.moisture) {
        throw new Error("Drying certificate requires moisture readings.");
      }
      return generateDryingCertificate(opts.job, opts.customer, opts.moisture);
  }
}

// Re-export for ease of import
export { parseSubjectBody };
