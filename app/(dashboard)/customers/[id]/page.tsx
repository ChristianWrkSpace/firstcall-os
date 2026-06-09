import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GLASS_STATUS, GLASS_STATUS_FALLBACK } from "@/lib/constants";
import { PageShell, Glass, Band, GlassRow, EmptyState } from "@/components/ui/Glass";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: customer }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("jobs")
      .select("id, job_number, status, type, created_at, site_address, site_city")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();

  return (
    <PageShell
      eyebrow="People"
      title={customer.name}
      subtitle={`Customer since ${new Date(customer.created_at).toLocaleDateString()}`}
      action={
        <Link
          href="/customers"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Customers
        </Link>
      }
      width="wide"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Contact */}
        <Glass className="p-6">
          <h2 className="text-white/90 font-semibold mb-4">Contact</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <Field
              label="Phone"
              value={customer.phone}
              link={customer.phone ? `tel:${customer.phone}` : undefined}
            />
            <Field
              label="Email"
              value={customer.email}
              link={customer.email ? `mailto:${customer.email}` : undefined}
            />
            <Field
              label="Address"
              value={
                [customer.address, customer.city, customer.state, customer.zip]
                  .filter(Boolean)
                  .join(", ") || null
              }
            />
          </dl>
        </Glass>

        {/* Insurance */}
        <Glass className="p-6">
          <h2 className="text-white/90 font-semibold mb-4">Insurance</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <Field label="Carrier" value={customer.insurance_company} />
            <Field label="Policy #" value={customer.insurance_policy_number} mono />
            <Field label="Claim #" value={customer.insurance_claim_number} mono />
          </dl>
        </Glass>

        {/* Notes */}
        <Glass className="p-6">
          <h2 className="text-white/90 font-semibold mb-4">Notes</h2>
          {customer.notes ? (
            <p className="text-white/80 text-sm whitespace-pre-wrap">{customer.notes}</p>
          ) : (
            <p className="text-white/40 text-sm italic">No notes.</p>
          )}
        </Glass>
      </div>

      {/* Jobs */}
      <Band label="Jobs" hint={`${jobs?.length ?? 0} on file`}>
        {!jobs?.length ? (
          <EmptyState icon="📋" title="No jobs for this customer yet." />
        ) : (
          jobs.map((j: any, i: number) => (
            <GlassRow
              key={j.id}
              href={`/jobs/${j.id}`}
              index={i}
              meta={
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${GLASS_STATUS[j.status] ?? GLASS_STATUS_FALLBACK}`}
                >
                  {j.status}
                </span>
              }
              title={<span className="font-mono text-[#A6B8E7]">{j.job_number}</span>}
              sub={
                [
                  j.type ? `${j.type} damage` : null,
                  [j.site_address, j.site_city].filter(Boolean).join(", ") || null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")
              }
              trailing={
                <span className="text-white/30 text-[11px] font-mono">
                  {new Date(j.created_at).toLocaleDateString()}
                </span>
              }
            />
          ))
        )}
      </Band>
    </PageShell>
  );
}

function Field({
  label,
  value,
  link,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  link?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-white/40 text-xs uppercase tracking-wide">{label}</dt>
      <dd className={`text-white/80 ${mono ? "font-mono text-sm" : ""}`}>
        {value ? (
          link ? (
            <a href={link} className="text-[#A6B8E7] hover:text-white transition-colors">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-white/30">—</span>
        )}
      </dd>
    </div>
  );
}
