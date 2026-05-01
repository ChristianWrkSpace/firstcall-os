"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignToJob } from "@/app/actions/equipment";

const TYPE_META: Record<string, { icon: string; label: string }> = {
  lgr_dehumidifier: { icon: "💨", label: "LGR Dehu" },
  conventional_dehumidifier: { icon: "💨", label: "Conv. Dehu" },
  air_mover: { icon: "🌀", label: "Air Mover" },
  air_scrubber: { icon: "🌬", label: "Air Scrubber" },
  extractor: { icon: "💧", label: "Extractor" },
  other: { icon: "🛠", label: "Other" },
};

type AvailableEquipment = {
  id: string;
  type: string;
  serial_number: string;
  model: string | null;
};

export default function DeployEquipmentPicker({
  jobId,
  available,
}: {
  jobId: string;
  available: AvailableEquipment[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  // Group by type for the picker
  const grouped = new Map<string, AvailableEquipment[]>();
  for (const e of available) {
    if (!grouped.has(e.type)) grouped.set(e.type, []);
    grouped.get(e.type)!.push(e);
  }

  function deploy(equipmentId: string) {
    setError(null);
    setBusyId(equipmentId);
    startTransition(async () => {
      const res = await assignToJob(equipmentId, jobId);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
      setBusyId(null);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
      >
        + Deploy
      </button>
    );
  }

  return (
    <div className="w-full mt-3 bg-white/[0.03] border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">
          Pick from available inventory
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-zinc-500 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      {available.length === 0 ? (
        <p className="text-zinc-500 text-sm italic py-2">
          Nothing available in inventory. Add equipment in /equipment first.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from(grouped.entries()).map(([type, list]) => {
            const meta = TYPE_META[type] ?? { icon: "🛠", label: type };
            return (
              <div key={type}>
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold mb-1">
                  {meta.icon} {meta.label} ({list.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      disabled={pending}
                      onClick={() => deploy(e.id)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                        busyId === e.id
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-blue-500"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={e.model ?? ""}
                    >
                      {busyId === e.id ? "Deploying…" : `SN ${e.serial_number}`}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
          {error}
        </p>
      )}
    </div>
  );
}
