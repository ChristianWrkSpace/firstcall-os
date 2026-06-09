import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { PageShell, GlassRow, EmptyState } from "@/components/ui/Glass";

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
    <PageShell
      eyebrow="People"
      title="Customers"
      subtitle={`${customers?.length ?? 0}${q ? ` matching "${q}"` : " total"}`}
      action={
        q ? (
          <Link
            href="/customers"
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
          >
            Clear filter
          </Link>
        ) : undefined
      }
      width="wide"
    >
      {!customers?.length ? (
        <EmptyState
          icon="👤"
          title={q ? `No customers match "${q}".` : "No customers yet."}
        >
          {!q && "They're created automatically when you create a job or take a call."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((c: any, i: number) => {
            const jobs = c.jobs ?? [];
            const activeCount = jobs.filter(
              (j: any) => j.status !== "completed" && j.status !== "cancelled"
            ).length;
            return (
              <GlassRow
                key={c.id}
                href={`/customers/${c.id}`}
                index={i}
                meta={
                  activeCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 text-[10px] uppercase tracking-wide bg-[#5FBDB0]/10 text-[#A8DCD3] ring-[#5FBDB0]/20">
                      {activeCount} active
                    </span>
                  ) : undefined
                }
                title={c.name}
                sub={
                  [
                    [c.phone, c.email].filter(Boolean).join("  ·  ") || "No contact info",
                    c.insurance_company
                      ? `${c.insurance_company}${c.insurance_claim_number ? ` · ${c.insurance_claim_number}` : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("   —   ")
                }
                trailing={
                  <>
                    <span className="text-white/70 font-mono text-xs">
                      {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                    </span>
                    <span className="text-white/30 text-[11px] font-mono">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
