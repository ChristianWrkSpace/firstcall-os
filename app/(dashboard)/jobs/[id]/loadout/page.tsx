import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "./PrintButton";

function asArray<T = string>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim()) return [v as T];
  return [];
}

export default async function LoadoutSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, customers(*)")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const customer = job.customers as any;
  const scope = (job.scope_assessment ?? {}) as any;
  const inputs = (job.dispatch_inputs ?? {}) as any;
  const eq = scope.equipment_needed ?? {};
  const otherEq = asArray<string>(eq.other);
  const ppe = asArray<string>(scope.ppe_required);
  const safety = asArray<string>(scope.safety_concerns);
  const areas = asArray<any>(scope.affected_areas);
  const steps = asArray<string>(scope.mitigation_steps);
  const assumptions = asArray<string>(scope.calculations?.key_assumptions);

  // Build flat equipment list
  const items: Array<{ name: string; qty: number | string; verify: boolean }> = [];
  if (eq.lgr_dehumidifiers) items.push({ name: "LGR Dehumidifiers", qty: eq.lgr_dehumidifiers, verify: scope.confidence !== "high" });
  if (eq.conventional_dehumidifiers) items.push({ name: "Conventional Dehumidifiers", qty: eq.conventional_dehumidifiers, verify: scope.confidence !== "high" });
  if (eq.air_movers) items.push({ name: "Air Movers", qty: eq.air_movers, verify: scope.confidence !== "high" });
  if (eq.air_scrubbers) items.push({ name: "Air Scrubbers", qty: eq.air_scrubbers, verify: scope.confidence !== "high" });
  for (const o of otherEq) items.push({ name: o, qty: 1, verify: false });

  return (
    <div className="bg-white text-black p-8 print:p-0 min-h-screen">
      {/* Screen-only nav (hidden on print) */}
      <div className="flex items-center justify-between mb-6 print:hidden max-w-4xl mx-auto">
        <Link href={`/jobs/${id}`} className="text-zinc-600 hover:text-black text-sm">
          ← Back to Job
        </Link>
        <PrintButton />
      </div>

      <div className="max-w-4xl mx-auto bg-white p-8 print:p-0">
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">First Call Mitigation</p>
            <h1 className="text-3xl font-bold mt-1">Truck Loadout</h1>
            <p className="text-sm text-zinc-700 mt-1">
              Job <span className="font-mono font-semibold">{job.job_number}</span> · {customer?.name ?? "—"}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            <p>Generated {new Date().toLocaleString()}</p>
            {job.scope_analyzed_at && (
              <p>Scope analyzed {new Date(job.scope_analyzed_at).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Site + Contact */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Site Address</p>
            <p className="font-medium">
              {[job.site_address, job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ") || "—"}
            </p>
            {inputs.access_notes && (
              <p className="text-xs text-zinc-700 mt-1 italic">⚠ {inputs.access_notes}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Customer Contact</p>
            <p className="font-medium">{customer?.name}</p>
            {customer?.phone && <p className="text-sm">{customer.phone}</p>}
          </div>
        </div>

        {/* Job overview badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {scope.water_category && scope.water_category !== "n/a" && (
            <Badge>Cat {scope.water_category}</Badge>
          )}
          {scope.water_class && scope.water_class !== "n/a" && (
            <Badge>Class {scope.water_class}</Badge>
          )}
          {scope.estimated_dry_days && <Badge>{scope.estimated_dry_days}-day dry</Badge>}
          {inputs.ceiling_height_ft && <Badge>{inputs.ceiling_height_ft}ft ceilings</Badge>}
          {inputs.water_source_secured === false && (
            <Badge urgent>⚠ SOURCE NOT SECURED</Badge>
          )}
          {scope.confidence && (
            <Badge urgent={scope.confidence === "low"}>
              {scope.confidence.toUpperCase()} CONFIDENCE
            </Badge>
          )}
        </div>

        {/* Summary */}
        {scope.summary && (
          <div className="bg-zinc-100 border-l-4 border-blue-600 p-4 mb-6">
            <p className="text-xs uppercase tracking-wide text-zinc-600 mb-1">Brief</p>
            <p className="text-sm leading-relaxed">{scope.summary}</p>
          </div>
        )}

        {/* Equipment Loadout — the main attraction */}
        <section className="mb-6">
          <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">🛠 Equipment to Load</h2>
          {items.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-300">
                  <th className="text-left py-2 w-12">✓</th>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2 w-24">Qty</th>
                  <th className="text-left py-2 w-40 pl-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-200">
                    <td className="py-2.5">
                      <span className="inline-block w-5 h-5 border-2 border-black"></span>
                    </td>
                    <td className="py-2.5 font-medium">{item.name}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-base">×{item.qty}</td>
                    <td className="py-2.5 pl-4">
                      {item.verify ? (
                        <span className="text-yellow-700 text-xs font-medium">VERIFY ON ARRIVAL</span>
                      ) : (
                        <span className="text-green-700 text-xs font-medium">CONFIRMED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-zinc-500 text-sm italic">No equipment scoped yet — run Argus first.</p>
          )}
        </section>

        {/* The Math */}
        {scope.calculations && (
          <section className="mb-6 page-break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">🧮 How These Numbers Were Calculated</h2>
            <div className="text-sm space-y-2 font-mono bg-zinc-50 p-3 rounded">
              {scope.calculations.air_mover_math && (
                <p><span className="font-bold">AM:</span> {scope.calculations.air_mover_math}</p>
              )}
              {scope.calculations.dehumidifier_math && (
                <p><span className="font-bold">Dehu:</span> {scope.calculations.dehumidifier_math}</p>
              )}
              {scope.calculations.air_scrubber_math && (
                <p><span className="font-bold">Scrub:</span> {scope.calculations.air_scrubber_math}</p>
              )}
              {scope.calculations.safety_factor_applied && (
                <p><span className="font-bold">Buffer:</span> {scope.calculations.safety_factor_applied}</p>
              )}
            </div>
          </section>
        )}

        {/* PPE */}
        {ppe.length > 0 && (
          <section className="mb-6 page-break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">🦺 PPE Required</h2>
            <div className="grid grid-cols-2 gap-2">
              {ppe.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-4 h-4 border border-black"></span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Safety */}
        {safety.length > 0 && (
          <section className="mb-6 page-break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">⚠️ Safety Concerns</h2>
            <ul className="text-sm space-y-1.5 list-disc list-inside">
              {safety.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {/* On-arrival verifications */}
        {assumptions.length > 0 && (
          <section className="mb-6 page-break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">📋 Verify On Arrival</h2>
            <ul className="text-sm space-y-1.5">
              {assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="inline-block w-4 h-4 border border-black mt-0.5 shrink-0"></span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Affected Areas */}
        {areas.length > 0 && (
          <section className="mb-6 page-break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">📍 Affected Areas</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-300 text-xs uppercase tracking-wide text-zinc-600">
                  <th className="text-left py-1.5">Location</th>
                  <th className="text-left py-1.5">Materials</th>
                  <th className="text-right py-1.5 w-20">Sqft</th>
                  <th className="text-left py-1.5 pl-3 w-24">Severity</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a: any, i: number) => (
                  <tr key={i} className="border-b border-zinc-200 align-top">
                    <td className="py-1.5 font-medium">{a.location}</td>
                    <td className="py-1.5">{asArray<string>(a.materials).join(", ")}</td>
                    <td className="py-1.5 text-right font-mono">{a.estimated_sqft ?? "—"}</td>
                    <td className="py-1.5 pl-3 capitalize">{a.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Mitigation Steps */}
        {steps.length > 0 && (
          <section className="mb-6 page-break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 border-b border-black pb-1">📋 Mitigation Plan</h2>
            <ol className="text-sm space-y-1.5 list-decimal list-inside">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        {/* Tech sign-off */}
        <div className="mt-10 pt-4 border-t-2 border-black grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600 mb-6">Lead Tech</p>
            <div className="border-b border-black h-1"></div>
            <p className="text-xs text-zinc-600 mt-1">Signature / Date</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600 mb-6">Truck #</p>
            <div className="border-b border-black h-1"></div>
            <p className="text-xs text-zinc-600 mt-1">Confirmed equipment loaded</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, urgent }: { children: React.ReactNode; urgent?: boolean }) {
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
        urgent ? "bg-red-100 text-red-800 border-red-300" : "bg-zinc-100 text-zinc-800 border-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}
