import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function PartnersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Partners</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Plumbers, adjusters, property managers, referral sources.
          </p>
        </div>
        <Link
          href="/partners/outreach"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          🎯 B2B Outreach
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        {!partners?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No partners yet. Convert leads from{" "}
            <Link href="/partners/outreach" className="text-blue-400 hover:underline">
              Outreach Pipeline
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Company</th>
                <th className="px-5 py-3 text-left">Phone</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Added</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p: any) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-5 py-3 text-white">{p.name}</td>
                  <td className="px-5 py-3 text-zinc-300">{p.company ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">{p.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">{p.email ?? "—"}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">
                    {new Date(p.created_at).toLocaleDateString()}
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
