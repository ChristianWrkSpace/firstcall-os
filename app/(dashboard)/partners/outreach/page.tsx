import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { BUSINESS_TYPES } from "@/lib/hunter-types";
import { PageShell, GlassRow, EmptyState } from "@/components/ui/Glass";

// Outreach-lead status pills in the glass palette. Converted = the win state,
// so it earns the rationed teal; followed-up is amber (awaiting a human reply).
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

export default async function OutreachPipeline() {
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();
  let leadsQuery = supabase
    .from("outreach_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (cutoff) leadsQuery = leadsQuery.gte("created_at", cutoff);
  const { data: leads } = await leadsQuery;

  // Status counts
  const counts: Record<string, number> = {};
  for (const l of leads ?? []) {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  }

  return (
    <PageShell
      eyebrow="Growth"
      title="B2B Outreach Pipeline"
      subtitle="Hunter drafts personalized cold outreach for hotels, plumbers, property managers in Austin."
      action={
        <div className="flex items-center gap-2">
          <Link
            href="/partners"
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
          >
            ← Partners
          </Link>
          <Link
            href="/partners/outreach/new"
            className="px-4 py-1.5 rounded-lg bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-medium shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:opacity-95 transition-opacity"
          >
            + Add Lead
          </Link>
        </div>
      }
      width="wide"
    >
      {/* Pipeline counts */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-6">
        {[
          ["new", "New"],
          ["researching", "Researching"],
          ["drafted", "Drafted"],
          ["sent", "Sent"],
          ["followed_up", "Followed up"],
          ["replied", "Replied"],
          ["converted", "Converted"],
          ["no_response", "No reply"],
          ["disqualified", "DQ'd"],
        ].map(([key, label]) => (
          <div
            key={key}
            className="rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ring-white/[0.04] p-2.5"
          >
            <p className="text-white/40 text-[10px] uppercase tracking-wide truncate">{label}</p>
            <p
              className={`text-2xl font-bold mt-0.5 font-mono ${
                (counts[key] ?? 0) > 0 ? "text-white/95" : "text-white/20"
              }`}
            >
              {counts[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {!leads?.length ? (
        <EmptyState icon="🎯" title="No leads yet.">
          <Link href="/partners/outreach/new" className="text-[#A6B8E7] hover:text-white transition-colors">
            Add your first lead →
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((l: any, i: number) => (
            <GlassRow
              key={l.id}
              href={`/partners/outreach/${l.id}`}
              index={i}
              meta={
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${LEAD_STATUS_GLASS[l.status] ?? LEAD_STATUS_GLASS.researching}`}
                >
                  {l.status.replace("_", " ")}
                </span>
              }
              title={l.company_name}
              sub={
                [
                  BUSINESS_TYPES[l.business_type as keyof typeof BUSINESS_TYPES]?.label ??
                    l.business_type,
                  l.contact_name
                    ? `${l.contact_name}${l.contact_email ? ` · ${l.contact_email}` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")
              }
              trailing={
                <span className="text-white/30 text-[11px] font-mono">
                  {new Date(l.created_at).toLocaleDateString()}
                </span>
              }
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
