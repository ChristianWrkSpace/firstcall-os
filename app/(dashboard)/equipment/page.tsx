import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_COLORS,
  equipmentTypeLabel,
} from "@/lib/equipment-types";

export default async function EquipmentListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const { type, status } = await searchParams;
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("equipment")
    .select("*, jobs:current_job_id(job_number)")
    .order("status", { ascending: true })
    .order("type", { ascending: true })
    .order("serial_number", { ascending: true });

  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);

  const { data: equipment } = await query;

  // Counts for status summary
  const { data: allForCount } = await supabase
    .from("equipment")
    .select("status");
  const counts = {
    available: 0,
    deployed: 0,
    maintenance: 0,
    retired: 0,
  } as Record<string, number>;
  for (const e of allForCount ?? []) {
    if (e.status in counts) counts[e.status] += 1;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipment</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            <span className="text-green-400">{counts.available} available</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-blue-400">{counts.deployed} deployed</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-yellow-400">{counts.maintenance} maintenance</span>
            <span className="text-zinc-600"> · </span>
            <span className="text-zinc-500">{counts.retired} retired</span>
          </p>
        </div>
        <Link
          href="/equipment/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Equipment
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterPill href="/equipment" label="All" active={!type && !status} />
        {EQUIPMENT_STATUSES.map((s) => (
          <FilterPill
            key={s}
            href={`/equipment?status=${s}`}
            label={s}
            active={status === s}
            color={EQUIPMENT_STATUS_COLORS[s]}
          />
        ))}
        <span className="w-px bg-zinc-800 mx-1" />
        {EQUIPMENT_TYPES.map((t) => (
          <FilterPill
            key={t.value}
            href={`/equipment?type=${t.value}`}
            label={t.label}
            active={type === t.value}
          />
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {!equipment?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No equipment yet.{" "}
            <Link href="/equipment/new" className="text-blue-400 hover:underline">
              Add your first piece →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Serial #</th>
                <th className="px-5 py-3 text-left">Model</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Current Job</th>
                <th className="px-5 py-3 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq) => {
                const job = (eq as any).jobs;
                return (
                  <tr
                    key={eq.id}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-5 py-3 text-zinc-300">
                      {equipmentTypeLabel(eq.type)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/equipment/${eq.id}`}
                        className="text-blue-400 hover:underline font-mono text-xs"
                      >
                        {eq.serial_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {[eq.manufacturer, eq.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${EQUIPMENT_STATUS_COLORS[eq.status] ?? ""}`}
                      >
                        {eq.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {job?.job_number ? (
                        <Link
                          href={`/jobs/${eq.current_job_id}`}
                          className="text-blue-400 hover:underline font-mono text-xs"
                        >
                          {job.job_number}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-300 font-mono text-xs">
                      {Number(eq.hours_logged ?? 0).toFixed(0)}
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

function FilterPill({
  href,
  label,
  active,
  color,
}: {
  href: string;
  label: string;
  active?: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors border ${
        active
          ? color ?? "bg-blue-600 text-white border-blue-600"
          : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
