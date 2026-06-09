"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retrieveFromJob } from "@/app/actions/equipment";

export default function RetrieveEquipmentButton({
  equipmentId,
  label,
}: {
  equipmentId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleRetrieve() {
    if (!confirm(`Retrieve ${label}? It will be marked Available in inventory.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await retrieveFromJob(equipmentId, null);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleRetrieve}
        disabled={pending}
        className="px-2 py-1 text-xs rounded-md bg-shade hover:bg-shade text-ink hover:text-ink border border-edge2 hover:border-edge2 transition-colors disabled:opacity-50"
      >
        {pending ? "Retrieving…" : "↩ Retrieve"}
      </button>
      {error && <span className="text-red-700 text-[10px]">{error}</span>}
    </div>
  );
}
