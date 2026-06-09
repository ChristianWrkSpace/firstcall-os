import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";

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
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/customers"
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Customers
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">{customer.name}</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          Customer since {new Date(customer.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contact */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-4">Contact</h2>
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
        </section>

        {/* Insurance */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-4">Insurance</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <Field label="Carrier" value={customer.insurance_company} />
            <Field label="Policy #" value={customer.insurance_policy_number} mono />
            <Field label="Claim #" value={customer.insurance_claim_number} mono />
          </dl>
        </section>

        {/* Notes */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-4">Notes</h2>
          {customer.notes ? (
            <p className="text-ink text-sm whitespace-pre-wrap">
              {customer.notes}
            </p>
          ) : (
            <p className="text-ink-3 text-sm italic">No notes.</p>
          )}
        </section>
      </div>

      {/* Jobs */}
      <section className="mt-5 glass-card p-6">
        <h2 className="text-ink font-semibold mb-4">
          Jobs ({jobs?.length ?? 0})
        </h2>
        {!jobs?.length ? (
          <p className="text-ink-3 text-sm italic">No jobs for this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                  <th className="text-left py-2">Job #</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => (
                  <tr
                    key={j.id}
                    className="border-b border-edge2/60 last:border-0 hover:bg-shade"
                  >
                    <td className="py-2.5">
                      <Link
                        href={`/jobs/${j.id}`}
                        className="text-info hover:underline font-mono text-xs"
                      >
                        {j.job_number}
                      </Link>
                    </td>
                    <td className="py-2.5 text-ink-2 text-xs capitalize">
                      {j.type}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[j.status] ?? ""}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-ink-2 text-xs">
                      {[j.site_address, j.site_city].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-2.5 text-ink-3 text-xs">
                      {new Date(j.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
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
      <dt className="text-ink-3 text-xs uppercase tracking-wide">{label}</dt>
      <dd className={`text-ink ${mono ? "font-mono text-sm" : ""}`}>
        {value ? (
          link ? (
            <a href={link} className="text-info hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </dd>
    </div>
  );
}
