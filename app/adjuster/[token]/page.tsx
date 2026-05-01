import { createAdminClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import { docTypeMeta } from "@/lib/document-types";

export default async function AdjusterPortal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, job_number, status, type, description, created_at, scheduled_at, site_address, site_city, site_state, site_zip, scope_assessment, scope_analyzed_at, customers(name, email, phone, insurance_company, insurance_policy_number, insurance_claim_number)"
    )
    .eq("adjuster_share_token", token)
    .single();

  if (!job) notFound();

  const customer = (job as any).customers;

  const [{ data: photos }, { data: documents }, { data: moisture }, { data: estimates }, { data: legalDocs }] =
    await Promise.all([
      admin
        .from("job_photos")
        .select("id, storage_path")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("job_documents")
        .select("id, doc_type, filename, storage_path, signed, signed_at, signed_by_name")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false }),
      admin
        .from("moisture_readings")
        .select("*")
        .eq("job_id", job.id)
        .order("reading_date", { ascending: false })
        .limit(50),
      admin
        .from("estimates")
        .select(
          "id, version, status, generation_meta, line_items:estimate_line_items(category, description, quantity, unit, unit_price, line_total, xactimate_code, sort_order)"
        )
        .eq("job_id", job.id)
        .in("status", ["approved", "sent"])
        .order("version", { ascending: false }),
      admin
        .from("legal_documents")
        .select("id, doc_type, status, signed_at, signed_by_name, sent_at, sent_to, signing_token")
        .eq("job_id", job.id)
        .in("status", ["sent", "signed"])
        .order("created_at", { ascending: false }),
    ]);

  // Photo signed URLs
  const photoUrls: Array<{ id: string; url: string }> = [];
  for (const p of photos ?? []) {
    const { data } = await admin.storage
      .from("job-photos")
      .createSignedUrl(p.storage_path, 60 * 60);
    if (data) photoUrls.push({ id: p.id, url: data.signedUrl });
  }

  // Document signed URLs
  const docsWithUrls: Array<any> = [];
  for (const d of documents ?? []) {
    const { data } = await admin.storage
      .from("job-documents")
      .createSignedUrl(d.storage_path, 60 * 60);
    if (data) docsWithUrls.push({ ...d, url: data.signedUrl });
  }

  const scope = (job as any).scope_assessment ?? {};
  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Moisture grouped by date
  const moistureByDate: Record<string, any[]> = {};
  for (const r of moisture ?? []) {
    if (!moistureByDate[r.reading_date]) moistureByDate[r.reading_date] = [];
    moistureByDate[r.reading_date].push(r);
  }
  const moistureDates = Object.keys(moistureByDate).sort().reverse();

  return (
    <div className="min-h-screen bg-zinc-950">
      <header
        className="bg-zinc-900 border-b-2 border-blue-600 px-6 pb-5"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <Logo variant="banner" size={36} priority />
            <p className="text-zinc-500 text-xs uppercase tracking-wider">
              Claim Packet · Adjuster View
            </p>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">Job #</p>
            <p className="text-white font-mono text-sm">{job.job_number}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Top summary card */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <Field label="Insured" value={customer?.name} />
            <Field label="Loss Type" value={(job as any).type} capitalize />
            <Field label="Carrier" value={customer?.insurance_company} />
            <Field label="Claim #" value={customer?.insurance_claim_number} mono />
            <div className="md:col-span-4">
              <Field
                label="Loss Address"
                value={
                  [job.site_address, job.site_city, job.site_state, job.site_zip]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </div>
            {(job as any).description && (
              <div className="md:col-span-4">
                <Field label="Reported Damage" value={(job as any).description} />
              </div>
            )}
          </div>
        </section>

        {/* Argus scope */}
        {scope.summary && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <h2 className="text-white font-semibold mb-2">📋 Scope of Work</h2>
            <p className="text-zinc-300 text-sm leading-relaxed mb-4">{scope.summary}</p>
            <div className="flex flex-wrap gap-2">
              {scope.water_category && scope.water_category !== "n/a" && (
                <Pill>Cat {scope.water_category}</Pill>
              )}
              {scope.water_class && scope.water_class !== "n/a" && (
                <Pill>Class {scope.water_class}</Pill>
              )}
              {scope.estimated_dry_days && (
                <Pill>{scope.estimated_dry_days}-day dry</Pill>
              )}
            </div>
          </section>
        )}

        {/* Approved estimate */}
        {estimates && estimates.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <h2 className="text-white font-semibold mb-3">💰 Approved Estimate</h2>
            {estimates.slice(0, 1).map((est: any) => {
              const lines = (est.line_items ?? []).sort(
                (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
              );
              const total = lines.reduce(
                (s: number, l: any) => s + Number(l.line_total ?? 0),
                0
              );
              return (
                <div key={est.id}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                          <th className="text-left py-2">Code</th>
                          <th className="text-left py-2">Description</th>
                          <th className="text-right py-2">Qty</th>
                          <th className="text-left py-2 pl-2">Unit</th>
                          <th className="text-right py-2">Unit $</th>
                          <th className="text-right py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l: any, i: number) => (
                          <tr key={i} className="border-b border-zinc-800/40">
                            <td className="py-1.5 text-zinc-400 text-xs font-mono">
                              {l.xactimate_code ?? "—"}
                            </td>
                            <td className="py-1.5 text-zinc-200">{l.description}</td>
                            <td className="py-1.5 text-right text-zinc-300 font-mono text-xs">
                              {Number(l.quantity).toFixed(2)}
                            </td>
                            <td className="py-1.5 pl-2 text-zinc-500 text-xs uppercase">
                              {l.unit}
                            </td>
                            <td className="py-1.5 text-right text-zinc-300 font-mono text-xs">
                              {fmt(Number(l.unit_price))}
                            </td>
                            <td className="py-1.5 text-right text-white font-mono text-xs">
                              {fmt(Number(l.line_total))}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={5} className="py-2 text-right text-zinc-300 font-semibold">
                            Total
                          </td>
                          <td className="py-2 text-right text-white font-mono text-base font-bold">
                            {fmt(total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Site photos */}
        {photoUrls.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <h2 className="text-white font-semibold mb-3">📸 Site Photos</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {photoUrls.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="aspect-square bg-zinc-800 rounded overflow-hidden"
                >
                  <img
                    src={p.url}
                    alt=""
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Legal Documents (Esquire-drafted, e-signed) */}
        {(legalDocs?.length ?? 0) > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <h2 className="text-white font-semibold mb-3">⚖️ Legal Documents</h2>
            <ul className="flex flex-col gap-2">
              {(legalDocs as any[]).map((d) => {
                const labels: Record<string, string> = {
                  aob: "Assignment of Benefits",
                  direction_to_pay: "Direction to Pay",
                  work_authorization: "Work Authorization",
                  drying_certificate: "Drying Certificate",
                };
                const isSigned = d.status === "signed";
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2 text-sm gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white">
                        {labels[d.doc_type] ?? d.doc_type}
                      </p>
                      <p className="text-zinc-500 text-[10px]">
                        {isSigned
                          ? `Signed by ${d.signed_by_name ?? "homeowner"} ${new Date(d.signed_at).toLocaleDateString()}`
                          : `Awaiting signature — sent ${new Date(d.sent_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    {d.signing_token && (
                      <a
                        href={`/sign/${d.signing_token}`}
                        target="_blank"
                        rel="noopener"
                        className={`text-[10px] px-2.5 py-1 rounded font-semibold uppercase ${
                          isSigned
                            ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            : "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {isSigned ? "✓ View" : "Pending"}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Documents (uploaded paper docs) */}
        {docsWithUrls.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <h2 className="text-white font-semibold mb-3">📑 Documents</h2>
            <ul className="flex flex-col gap-2">
              {docsWithUrls.map((d: any) => {
                const meta = docTypeMeta(d.doc_type);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span>{meta.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-white truncate">{d.filename}</p>
                        <p className="text-zinc-500 text-[10px]">
                          {meta.label}
                          {d.signed && d.signed_by_name && (
                            <> · ✓ signed by {d.signed_by_name}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium"
                    >
                      View
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Moisture log */}
        {moistureDates.length > 0 && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
            <h2 className="text-white font-semibold mb-3">💧 Moisture Readings</h2>
            <div className="flex flex-col gap-3">
              {moistureDates.map((date) => (
                <div key={date}>
                  <p className="text-zinc-400 text-xs uppercase tracking-wide font-semibold mb-1.5">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wide">
                          <th className="text-left py-1.5">Room</th>
                          <th className="text-left py-1.5">Material</th>
                          <th className="text-right py-1.5">Moisture</th>
                          <th className="text-right py-1.5">RH</th>
                          <th className="text-right py-1.5">Temp</th>
                          <th className="text-right py-1.5">GPP</th>
                          <th className="text-center py-1.5">Dry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moistureByDate[date].map((r: any) => (
                          <tr key={r.id} className="border-b border-zinc-800/40">
                            <td className="py-1.5 text-zinc-200">{r.room}</td>
                            <td className="py-1.5 text-zinc-400">
                              {r.material?.replace(/_/g, " ") ?? "—"}
                            </td>
                            <td className="py-1.5 text-right text-zinc-300 font-mono">
                              {r.moisture_pct !== null ? `${r.moisture_pct}%` : "—"}
                            </td>
                            <td className="py-1.5 text-right text-zinc-400 font-mono">
                              {r.rh_pct !== null ? `${r.rh_pct}%` : "—"}
                            </td>
                            <td className="py-1.5 text-right text-zinc-400 font-mono">
                              {r.temp_f !== null ? `${r.temp_f}°` : "—"}
                            </td>
                            <td className="py-1.5 text-right text-zinc-400 font-mono">
                              {r.gpp !== null ? r.gpp : "—"}
                            </td>
                            <td className="py-1.5 text-center">
                              {r.is_dry_standard ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-zinc-700">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-zinc-600 text-xs">
          First Call Mitigation · Austin, TX · IICRC Certified · Adjuster Packet for Job{" "}
          {job.job_number}
        </footer>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  capitalize?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p
        className={`text-zinc-100 ${capitalize ? "capitalize" : ""} ${mono ? "font-mono text-sm" : ""}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-200 border border-zinc-700">
      {children}
    </span>
  );
}
