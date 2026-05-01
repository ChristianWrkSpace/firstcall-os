import Link from "next/link";
import RetrieveEquipmentButton from "./RetrieveEquipmentButton";

const TYPE_META: Record<
  string,
  { icon: string; label: string }
> = {
  lgr_dehumidifier: { icon: "💨", label: "LGR Dehu" },
  conventional_dehumidifier: { icon: "💨", label: "Conv. Dehu" },
  air_mover: { icon: "🌀", label: "Air Mover" },
  air_scrubber: { icon: "🌬", label: "Air Scrubber" },
  extractor: { icon: "💧", label: "Extractor" },
  other: { icon: "🛠", label: "Other" },
};

type Assignment = {
  id: string;
  deployed_at: string | null;
  hours_at_deploy: number | null;
  equipment: {
    id: string;
    type: string;
    serial_number: string;
    model: string | null;
    manufacturer: string | null;
  } | null;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function JobEquipment({
  assignments,
  recommended,
}: {
  assignments: Assignment[];
  recommended?: {
    lgr_dehumidifiers?: number;
    conventional_dehumidifiers?: number;
    air_movers?: number;
    air_scrubbers?: number;
  };
}) {
  // Group deployed by type
  const grouped = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const t = a.equipment?.type ?? "other";
    if (!grouped.has(t)) grouped.set(t, []);
    grouped.get(t)!.push(a);
  }

  // Compare deployed vs recommended (from Argus scope)
  const deployedCounts: Record<string, number> = {};
  for (const [type, list] of grouped) deployedCounts[type] = list.length;

  const compareRows: Array<{ type: string; deployed: number; needed: number }> = [];
  if (recommended) {
    if (recommended.lgr_dehumidifiers)
      compareRows.push({
        type: "lgr_dehumidifier",
        deployed: deployedCounts.lgr_dehumidifier ?? 0,
        needed: recommended.lgr_dehumidifiers,
      });
    if (recommended.conventional_dehumidifiers)
      compareRows.push({
        type: "conventional_dehumidifier",
        deployed: deployedCounts.conventional_dehumidifier ?? 0,
        needed: recommended.conventional_dehumidifiers,
      });
    if (recommended.air_movers)
      compareRows.push({
        type: "air_mover",
        deployed: deployedCounts.air_mover ?? 0,
        needed: recommended.air_movers,
      });
    if (recommended.air_scrubbers)
      compareRows.push({
        type: "air_scrubber",
        deployed: deployedCounts.air_scrubber ?? 0,
        needed: recommended.air_scrubbers,
      });
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {compareRows.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-yellow-300 text-xs uppercase tracking-wide font-semibold mb-2">
              Argus recommends
            </p>
            <div className="flex flex-wrap gap-2">
              {compareRows.map((r) => (
                <span
                  key={r.type}
                  className="px-2 py-1 bg-zinc-800 text-zinc-200 text-xs rounded"
                >
                  {TYPE_META[r.type]?.icon} {r.needed} × {TYPE_META[r.type]?.label ?? r.type}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="text-zinc-500 text-sm italic">
          No equipment deployed yet on this job.
        </p>
        <Link
          href="/equipment"
          className="text-blue-400 hover:underline text-sm self-start"
        >
          → Deploy from inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Compare summary — green if hitting target, yellow if short */}
      {compareRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {compareRows.map((r) => {
            const meta = TYPE_META[r.type] ?? { icon: "🛠", label: r.type };
            const ok = r.deployed >= r.needed;
            return (
              <div
                key={r.type}
                className={`px-3 py-2 rounded-lg border text-center ${
                  ok
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-yellow-500/5 border-yellow-500/20"
                }`}
              >
                <p className="text-base">{meta.icon}</p>
                <p
                  className={`text-sm font-mono font-semibold ${
                    ok ? "text-green-400" : "text-yellow-300"
                  }`}
                >
                  {r.deployed} / {r.needed}
                </p>
                <p className="text-zinc-400 text-[10px] uppercase tracking-wide">
                  {meta.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-unit list */}
      <ul className="flex flex-col gap-1.5">
        {assignments.map((a) => {
          const meta = TYPE_META[a.equipment?.type ?? "other"] ?? {
            icon: "🛠",
            label: a.equipment?.type ?? "Equipment",
          };
          const days = daysSince(a.deployed_at);
          return (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg"
            >
              <Link
                href={`/equipment/${a.equipment?.id ?? ""}`}
                className="flex items-center gap-3 min-w-0 flex-1 hover:text-blue-400 transition-colors"
              >
                <span className="text-lg shrink-0">{meta.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-white text-sm font-medium block truncate">
                    {meta.label}
                    {a.equipment?.model && (
                      <span className="text-zinc-400 font-normal"> · {a.equipment.model}</span>
                    )}
                  </span>
                  <span className="text-zinc-500 text-xs font-mono block truncate">
                    SN: {a.equipment?.serial_number ?? "—"}
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-zinc-400 text-xs text-right">
                  {days != null ? (
                    <>{days === 0 ? "today" : `${days}d on site`}</>
                  ) : (
                    "—"
                  )}
                </span>
                {a.equipment?.id && (
                  <RetrieveEquipmentButton
                    equipmentId={a.equipment.id}
                    label={`${meta.label} · SN ${a.equipment.serial_number}`}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        href="/equipment"
        className="text-blue-400 hover:underline text-xs self-start"
      >
        Manage in inventory →
      </Link>
    </div>
  );
}
