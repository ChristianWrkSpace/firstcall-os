import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import DeletionRequestForm from "./DeletionRequestForm";
import { PageShell, Glass } from "@/components/ui/Glass";

interface PiiField {
  table: string;
  column: string;
  classification: "direct" | "contact" | "financial" | "claim" | "biometric" | "auth";
  retention: string;
  notes?: string;
}

const PII_INVENTORY: PiiField[] = [
  // customers
  { table: "customers", column: "name", classification: "direct", retention: "7y after last activity" },
  { table: "customers", column: "email", classification: "contact", retention: "7y; redact on request" },
  { table: "customers", column: "phone", classification: "contact", retention: "7y; redact on request" },
  { table: "customers", column: "address", classification: "direct", retention: "7y; redact on request" },
  { table: "customers", column: "city / state / zip", classification: "direct", retention: "7y" },
  { table: "customers", column: "insurance_company", classification: "claim", retention: "7y" },
  { table: "customers", column: "insurance_policy_number", classification: "claim", retention: "7y" },
  { table: "customers", column: "insurance_claim_number", classification: "claim", retention: "7y" },
  { table: "customers", column: "notes", classification: "direct", retention: "7y; redact on request" },

  // jobs
  { table: "jobs", column: "site_address / site_city / site_zip", classification: "direct", retention: "7y" },
  { table: "jobs", column: "description", classification: "direct", retention: "7y" },
  { table: "jobs", column: "deductible_amount", classification: "financial", retention: "7y" },
  { table: "jobs", column: "customer_share_token", classification: "auth", retention: "Until revoked" },
  { table: "jobs", column: "adjuster_share_token", classification: "auth", retention: "Until revoked" },

  // invoices / payments — financial records (tax retention)
  { table: "invoices", column: "all amounts + customer link", classification: "financial", retention: "7y (IRS)" },
  { table: "payments", column: "amount, method, reference", classification: "financial", retention: "7y (IRS)" },

  // photos
  { table: "job_photos", column: "storage_path → image of property", classification: "direct", retention: "7y; redact on request", notes: "Stored in Supabase Storage; signed URLs only" },
  { table: "job_documents", column: "storage_path → uploads (AOB / IDs)", classification: "auth", retention: "7y", notes: "May contain signatures + IDs" },

  // calls
  { table: "calls", column: "recording_url", classification: "biometric", retention: "1y", notes: "Voice = biometric per § 521.002" },
  { table: "calls", column: "transcript", classification: "direct", retention: "1y" },

  // legal docs
  { table: "legal_documents", column: "body (AOB / Demand / Cert)", classification: "direct", retention: "10y", notes: "Long-tail litigation exposure" },

  // moisture
  { table: "moisture_readings", column: "(no PII)", classification: "claim", retention: "7y", notes: "Property data, not personal" },

  // auth
  { table: "auth.users (Supabase)", column: "email + hashed password", classification: "auth", retention: "Until account deletion", notes: "Supabase manages" },
  { table: "profiles", column: "name + email", classification: "auth", retention: "Until account deletion" },

  // outreach
  { table: "outreach_leads", column: "contact_name / email / phone", classification: "contact", retention: "3y or until unsubscribe" },
  { table: "outreach_messages", column: "draft_content / final_content", classification: "contact", retention: "3y" },

  // audit
  { table: "audit_logs", column: "user_id, ip_address, details JSON", classification: "auth", retention: "7y; append-only" },
];

const CLASS_BADGE: Record<PiiField["classification"], string> = {
  direct:    "bg-red-400/10 text-red-300",
  contact:   "bg-orange-400/10 text-orange-300",
  claim:     "bg-purple-400/10 text-purple-300",
  financial: "bg-emerald-400/10 text-emerald-300",
  biometric: "bg-pink-400/10 text-pink-300",
  auth:      "bg-[#6B8AD9]/10 text-[#A6B8E7]",
};

const CLASS_LABEL: Record<PiiField["classification"], string> = {
  direct:    "Direct PII",
  contact:   "Contact",
  claim:     "Claim/Insurance",
  financial: "Financial",
  biometric: "Biometric",
  auth:      "Auth/System",
};

export default async function PiiInventoryPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <PageShell eyebrow="Settings" title="PII Inventory" width="narrow">
        <p className="text-white/45 text-sm">Owner / manager only.</p>
      </PageShell>
    );
  }

  const isOwner = me.role === "owner";

  return (
    <PageShell
      eyebrow="Settings"
      title="🗂 PII Inventory"
      subtitle="Data dictionary of every column that holds personally identifiable information. Tex. Bus. & Com. Code §§ 521.052–521.053 govern handling and breach notification in Texas."
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="wide"
    >
      <Section title="Data Inventory">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
                <th className="text-left py-2 pr-3">Table</th>
                <th className="text-left py-2 pr-3">Column</th>
                <th className="text-left py-2 pr-3">Class</th>
                <th className="text-left py-2 pr-3">Retention</th>
                <th className="text-left py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {PII_INVENTORY.map((p, i) => (
                <tr key={i} className="border-b border-white/[0.06] last:border-0 align-top">
                  <td className="py-2 pr-3 text-white/70 font-mono text-xs">{p.table}</td>
                  <td className="py-2 pr-3 text-white/70 font-mono text-xs">{p.column}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${CLASS_BADGE[p.classification]}`}
                    >
                      {CLASS_LABEL[p.classification]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-white/45 text-xs">{p.retention}</td>
                  <td className="py-2 text-white/40 text-xs">{p.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Retention Policy">
        <ul className="flex flex-col gap-2 text-sm text-white/70 list-disc list-inside">
          <li>
            <strong className="text-white/90">Financial records (invoices/payments):</strong>{" "}
            7 years per IRS Section 6001 — even if a customer requests deletion.
            We redact identifying columns but keep amount + dates.
          </li>
          <li>
            <strong className="text-white/90">Call recordings:</strong> 1 year max.
            Voice is biometric data under TX § 521.002. Auto-purge cron is a
            future task — for now, manual cleanup quarterly.
          </li>
          <li>
            <strong className="text-white/90">Legal documents (AOBs, demand letters):</strong>{" "}
            10 years — longer than other PII because litigation can surface late.
          </li>
          <li>
            <strong className="text-white/90">Photos & uploaded docs:</strong> 7
            years aligned with the related job's records, redacted on request
            (storage object delete + DB row redact).
          </li>
          <li>
            <strong className="text-white/90">Outreach leads:</strong> 3 years or
            until they unsubscribe, whichever comes first.
          </li>
        </ul>
      </Section>

      <Section title="Customer Data Deletion Request">
        <p className="text-white/45 text-sm mb-3">
          When a customer asks us to delete their data, log the request, find
          them here, and redact PII columns. Financial records remain for tax
          compliance with all identifying data blanked.
        </p>
        <DeletionRequestForm isOwner={isOwner} />
      </Section>

      <Section title="Cross-Border + Vendor Data Movement">
        <ul className="flex flex-col gap-2 text-sm text-white/70 list-disc list-inside">
          <li>
            <strong className="text-white/90">Anthropic (Claude):</strong> sends
            customer text (call transcripts, scope descriptions, lead notes) to
            Anthropic API. Per Anthropic policy, no training on this data.
          </li>
          <li>
            <strong className="text-white/90">Deepgram:</strong> receives call
            audio for STT. Audio retained per Deepgram policy; we don't link
            their storage to ours.
          </li>
          <li>
            <strong className="text-white/90">ElevenLabs:</strong> receives
            assistant text for TTS — outbound only, no PII sent.
          </li>
          <li>
            <strong className="text-white/90">Stripe:</strong> receives customer
            email + payment amount + invoice number; no PII beyond what's
            needed for payment.
          </li>
          <li>
            <strong className="text-white/90">Resend:</strong> receives recipient
            email + branded message body for transactional sends.
          </li>
          <li>
            <strong className="text-white/90">Supabase + Vercel:</strong> primary
            data hosts. Both are SOC 2 Type II.
          </li>
        </ul>
      </Section>
    </PageShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Glass className="p-6 mb-5">
      <h2 className="text-white/90 font-semibold mb-3">{title}</h2>
      {children}
    </Glass>
  );
}
