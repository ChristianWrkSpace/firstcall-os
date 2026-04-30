import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { BUSINESS_TYPES } from "@/lib/hunter";

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

export default async function OutreachPipeline() {
  const supabase = await createServerSupabaseClient();
  const { data: leads } = await supabase
    .from("outreach_leads")
    .select("*")
    .order("created_at", { ascending: false });

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
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Partners
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">B2B Outreach Pipeline</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Hunter drafts personalized cold outreach for hotels, plumbers, property
            managers in Austin.
          </p>
        </div>
        <Link
          href="/partners/outreach/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
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
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5"
          >
            <p className="text-zinc-500 text-[10px] uppercase tracking-wide truncate">
              {label}
            </p>
            <p
              className={`text-2xl font-bold mt-0.5 ${
                (counts[key] ?? 0) > 0 ? "text-white" : "text-zinc-700"
              }`}
            >
              {counts[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        {!leads?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No leads yet.{" "}
            <Link href="/partners/outreach/new" className="text-blue-400 hover:underline">
              Add your first lead →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
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
                  className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/partners/outreach/${l.id}`}
                      className="text-blue-400 hover:underline font-medium"
                    >
                      {l.company_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">
                    {BUSINESS_TYPES[l.business_type as keyof typeof BUSINESS_TYPES]?.label ??
                      l.business_type}
                  </td>
                  <td className="px-5 py-3 text-zinc-300 text-xs">
                    {l.contact_name ?? "—"}
                    {l.contact_email && (
                      <span className="text-zinc-500"> · {l.contact_email}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[l.status] ?? ""}`}
                    >
                      {l.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">
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
