import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  let query = supabase
    .from("customers")
    .select(
      "*, jobs:jobs!customer_id(id, status)"
    )
    .order("created_at", { ascending: false });

  if (cutoff) query = query.gte("created_at", cutoff);

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `name.ilike.${like},email.ilike.${like},phone.ilike.${like},insurance_company.ilike.${like},insurance_claim_number.ilike.${like}`
    );
  }

  const { data: customers } = await query;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {customers?.length ?? 0}
            {q ? ` matching "${q}"` : " total"}
          </p>
        </div>
        {q && (
          <Link
            href="/customers"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg"
          >
            Clear filter
          </Link>
        )}
      </div>

      <div className="glass-card overflow-x-auto">
        {!customers?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            {q ? `No customers match "${q}".` : "No customers yet — they're created automatically when you create a job or take a call."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Phone</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Insurance</th>
                <th className="px-5 py-3 text-right">Jobs</th>
                <th className="px-5 py-3 text-left">Added</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c: any) => {
                const jobs = c.jobs ?? [];
                const activeCount = jobs.filter(
                  (j: any) =>
                    j.status !== "completed" && j.status !== "cancelled"
                ).length;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-blue-400 hover:underline font-medium"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-300 text-xs">
                      {c.insurance_company ?? "—"}
                      {c.insurance_claim_number && (
                        <p className="text-zinc-500 font-mono text-[10px]">
                          {c.insurance_claim_number}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-300 text-xs">
                      {jobs.length}
                      {activeCount > 0 && (
                        <span className="text-blue-400">
                          {" "}({activeCount} active)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
