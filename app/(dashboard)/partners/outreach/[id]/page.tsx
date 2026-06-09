import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BUSINESS_TYPES } from "@/lib/hunter";
import LeadActions from "./LeadActions";
import MessageView from "./MessageView";

const STATUS_COLORS: Record<string, string> = {
  new:           "bg-blue-500/15 text-blue-400",
  researching:   "bg-zinc-700 text-zinc-300",
  drafted:       "bg-purple-500/15 text-purple-400",
  sent:          "bg-blue-500/15 text-blue-400",
  followed_up:   "bg-yellow-500/15 text-yellow-400",
  replied:       "bg-green-500/15 text-green-400",
  converted:     "bg-green-500/15 text-green-400",
  no_response:   "bg-zinc-800 text-zinc-500",
  disqualified:  "bg-red-500/15 text-red-400",
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
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/partners/outreach"
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Pipeline
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{lead.company_name}</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[lead.status] ?? ""}`}
            >
              {lead.status.replace("_", " ")}
            </span>
            <span className="text-zinc-400 text-sm">{meta?.label ?? lead.business_type}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Lead info */}
          <section className="glass-card p-6">
            <h2 className="text-white font-semibold mb-4">Lead Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Contact" value={lead.contact_name} />
              <Field label="Title" value={lead.contact_title} />
              <Field label="Email" value={lead.contact_email} />
              <Field label="Phone" value={lead.contact_phone} />
              <Field label="City" value={lead.city} />
              <Field label="Source" value={lead.source} />
              {lead.website && (
                <div className="sm:col-span-2">
                  <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">
                    Website
                  </p>
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener"
                    className="text-blue-400 hover:underline"
                  >
                    {lead.website}
                  </a>
                </div>
              )}
              {lead.notes && (
                <div className="sm:col-span-2">
                  <p className="text-zinc-400 text-xs uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-zinc-200">{lead.notes}</p>
                </div>
              )}
            </div>
          </section>

          {/* Messages */}
          <section className="glass-card p-6">
            <h2 className="text-white font-semibold mb-4">Outreach Messages</h2>
            {!messages?.length ? (
              <p className="text-zinc-500 text-sm italic">
                No messages drafted yet. Use the actions panel on the right.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m: any) => (
                  <MessageView key={m.id} message={m} leadId={lead.id} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-5">
          <section className="glass-card p-5">
            <h2 className="text-white font-semibold mb-3">Actions</h2>
            <LeadActions
              leadId={lead.id}
              status={lead.status}
              hasSentMessages={(messages ?? []).some((m: any) => m.status === "sent")}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-zinc-200">{value || "—"}</p>
    </div>
  );
}
