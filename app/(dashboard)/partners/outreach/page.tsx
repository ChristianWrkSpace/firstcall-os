import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { BUSINESS_TYPES } from "@/lib/hunter-types";

const STATUS_COLORS: Record<string, string> = {
  new:           "bg-info/10 text-info",
  researching:   "bg-shade text-ink-2",
  drafted:       "bg-violet-500/10 text-violet-700",
  sent:          "bg-info/10 text-info",
  followed_up:   "bg-honey/10 text-honey",
  replied:       "bg-pine/10 text-pine",
  converted:     "bg-pine/10 text-pine",
  no_response:   "bg-shade text-ink-3",
  disqualified:  "bg-red-600/10 text-red-700",
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
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <Link
            href="/partners"
            className="text-ink-3 hover:text-ink text-sm transition-colors"
          >
            ← Partners
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-1">B2B Outreach Pipeline</h1>
          <p className="text-ink-2 text-sm mt-0.5">
            Hunter drafts personalized cold outreach for hotels, plumbers, property
            managers in Austin.
          </p>
        </div>
        <Link
          href="/partners/outreach/new"
          className="px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Lead
        </Link>
      </div>

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
            className="bg-card border border-edge2 rounded-lg p-2.5"
          >
            <p className="text-ink-3 text-[10px] uppercase tracking-wide truncate">
              {label}
            </p>
            <p
              className={`text-2xl font-bold mt-0.5 ${
                (counts[key] ?? 0) > 0 ? "text-ink" : "text-ink-3"
              }`}
            >
              {counts[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        {!leads?.length ? (
          <div className="px-5 py-10 text-center text-ink-3 text-sm">
            No leads yet.{" "}
            <Link href="/partners/outreach/new" className="text-info hover:underline">
              Add your first lead →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Company</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Contact</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Added</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr
                  key={l.id}
                  className="border-b border-edge2 last:border-0 hover:bg-shade transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/partners/outreach/${l.id}`}
                      className="text-info hover:underline font-medium"
                    >
                      {l.company_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-2 text-xs">
                    {BUSINESS_TYPES[l.business_type as keyof typeof BUSINESS_TYPES]?.label ??
                      l.business_type}
                  </td>
                  <td className="px-5 py-3 text-ink-2 text-xs">
                    {l.contact_name ?? "—"}
                    {l.contact_email && (
                      <span className="text-ink-3"> · {l.contact_email}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[l.status] ?? ""}`}
                    >
                      {l.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-3 text-xs">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
