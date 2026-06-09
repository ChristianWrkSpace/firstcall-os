import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BUSINESS_TYPES } from "@/lib/hunter";
import LeadActions from "./LeadActions";
import MessageView from "./MessageView";
import { PageShell, Glass, EmptyState } from "@/components/ui/Glass";

const LEAD_STATUS_GLASS: Record<string, string> = {
  new:          "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  researching:  "bg-white/5 text-white/60 ring-white/10",
  drafted:      "bg-purple-400/10 text-purple-300 ring-purple-400/20",
  sent:         "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  followed_up:  "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  replied:      "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  converted:    "bg-[#5FBDB0]/12 text-[#A8DCD3] ring-[#5FBDB0]/25",
  no_response:  "bg-white/5 text-white/35 ring-white/10",
  disqualified: "bg-red-400/10 text-red-300 ring-red-400/20",
};

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: lead }, { data: messages }] = await Promise.all([
    supabase.from("outreach_leads").select("*").eq("id", id).single(),
    supabase
      .from("outreach_messages")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!lead) notFound();

  const meta = BUSINESS_TYPES[lead.business_type as keyof typeof BUSINESS_TYPES];

  return (
    <PageShell
      eyebrow="Lead"
      title={lead.company_name}
      subtitle={
        <span className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ring-1 ${LEAD_STATUS_GLASS[lead.status] ?? LEAD_STATUS_GLASS.researching}`}
          >
            {lead.status.replace("_", " ")}
          </span>
          <span>{meta?.label ?? lead.business_type}</span>
        </span>
      }
      action={
        <Link
          href="/partners/outreach"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Pipeline
        </Link>
      }
      width="wide"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Lead info */}
          <Glass className="p-6">
            <h2 className="text-white/90 font-semibold mb-4">Lead Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Contact" value={lead.contact_name} />
              <Field label="Title" value={lead.contact_title} />
              <Field label="Email" value={lead.contact_email} />
              <Field label="Phone" value={lead.contact_phone} />
              <Field label="City" value={lead.city} />
              <Field label="Source" value={lead.source} />
              {lead.website && (
                <div className="sm:col-span-2">
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-0.5">Website</p>
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener"
                    className="text-[#A6B8E7] hover:text-white transition-colors"
                  >
                    {lead.website}
                  </a>
                </div>
              )}
              {lead.notes && (
                <div className="sm:col-span-2">
                  <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-white/80">{lead.notes}</p>
                </div>
              )}
            </div>
          </Glass>

          {/* Messages */}
          <Glass className="p-6">
            <h2 className="text-white/90 font-semibold mb-4">Outreach Messages</h2>
            {!messages?.length ? (
              <EmptyState icon="✉️" title="No messages drafted yet.">
                Use the actions panel on the right.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m: any) => (
                  <MessageView key={m.id} message={m} leadId={lead.id} />
                ))}
              </div>
            )}
          </Glass>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-5">
          <Glass className="p-5">
            <h2 className="text-white/90 font-semibold mb-3">Actions</h2>
            <LeadActions
              leadId={lead.id}
              status={lead.status}
              hasSentMessages={(messages ?? []).some((m: any) => m.status === "sent")}
            />
          </Glass>
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-white/40 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-white/80">{value || "—"}</p>
    </div>
  );
}
