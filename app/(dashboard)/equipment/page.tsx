import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_STATUSES,
  equipmentTypeLabel,
} from "@/lib/equipment-types";
import { PageShell, GlassRow, EmptyState } from "@/components/ui/Glass";

// Equipment-status pills in the glass palette.
const EQ_STATUS_GLASS: Record<string, string> = {
  available:   "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  deployed:    "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  maintenance: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  retired:     "bg-white/5 text-white/35 ring-white/10",
};

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
  const { data: allForCount } = await supabase.from("equipment").select("status");
  const counts = { available: 0, deployed: 0, maintenance: 0, retired: 0 } as Record<string, number>;
  for (const e of allForCount ?? []) {
    if (e.status in counts) counts[e.status] += 1;
  }

  return (
    <PageShell
      eyebrow="Inventory"
      title="Equipment"
      subtitle={
        <>
          <span className="text-emerald-300">{counts.available} available</span>
          <span className="text-white/25"> · </span>
          <span className="text-[#A6B8E7]">{counts.deployed} deployed</span>
          <span className="text-white/25"> · </span>
          <span className="text-amber-300">{counts.maintenance} maintenance</span>
          <span className="text-white/25"> · </span>
          <span className="text-white/40">{counts.retired} retired</span>
        </>
      }
      action={
        <Link
          href="/equipment/new"
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-semibold shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:shadow-[0_0_26px_rgba(95,189,176,0.4)] transition-shadow"
        >
          + Add Equipment
        </Link>
      }
      width="wide"
    >
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <FilterPill href="/equipment" label="All" active={!type && !status} />
        {EQUIPMENT_STATUSES.map((s) => (
          <FilterPill key={s} href={`/equipment?status=${s}`} label={s} active={status === s} />
        ))}
        <span className="w-px h-5 bg-white/10 mx-1" />
        {EQUIPMENT_TYPES.map((t) => (
          <FilterPill key={t.value} href={`/equipment?type=${t.value}`} label={t.label} active={type === t.value} />
        ))}
      </div>

      {!equipment?.length ? (
        <EmptyState icon="▤" title="No equipment here.">
          <Link href="/equipment/new" className="text-[#A8DCD3] hover:text-white transition-colors">
            Add your first piece →
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {equipment.map((eq: any, i: number) => {
            const job = eq.jobs;
            return (
              <GlassRow
                key={eq.id}
                href={`/equipment/${eq.id}`}
                index={i}
                meta={
                  <>
                    <span className="text-white/55 text-xs">{equipmentTypeLabel(eq.type)}</span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${EQ_STATUS_GLASS[eq.status] ?? EQ_STATUS_GLASS.retired}`}
                    >
                      {eq.status}
                    </span>
                  </>
                }
                title={<span className="font-mono">{eq.serial_number}</span>}
                sub={
                  [
                    [eq.manufacturer, eq.model].filter(Boolean).join(" ") || null,
                    job?.job_number ? `on ${job.job_number}` : null,
                  ]
                    .filter(Boolean)
                    .join("   ·   ") || undefined
                }
                trailing={
                  <>
                    <span className="text-white/80 font-mono text-sm">
                      {Number(eq.hours_logged ?? 0).toFixed(0)}
                    </span>
                    <span className="text-white/30 text-[10px] uppercase tracking-wide">hours</span>
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

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all border ${
        active
          ? "bg-white/[0.08] text-white border-white/20 ring-1 ring-[#5FBDB0]/20"
          : "bg-transparent text-white/45 border-white/[0.08] hover:border-white/20 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
