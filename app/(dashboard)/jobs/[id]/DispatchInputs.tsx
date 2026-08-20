"use client";

import { useState, useTransition } from "react";
import { saveDispatchInputs } from "@/app/actions/scope";

interface Inputs {
  ceiling_height_ft?: number;
  property_type?: "residential" | "commercial" | "multi_family";
  year_built?: string;
  stories?: number;
  water_source_secured?: boolean;
  access_notes?: string;
}

export default function DispatchInputsForm({
  jobId,
  initial,
}: {
  jobId: string;
  initial?: Inputs | null;
}) {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Inputs>(initial ?? {});
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function update<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveDispatchInputs(jobId, inputs as any);
      if (res.ok) {
        setSavedAt(Date.now());
        setOpen(false);
      }
    });
  }

  const summary = (() => {
    const parts: string[] = [];
    if (inputs.ceiling_height_ft) parts.push(`${inputs.ceiling_height_ft}ft ceilings`);
    if (inputs.property_type) parts.push(inputs.property_type.replace("_", " "));
    if (inputs.year_built) parts.push(`built ${inputs.year_built}`);
    if (inputs.stories) parts.push(`${inputs.stories} ${inputs.stories === 1 ? "story" : "stories"}`);
    if (inputs.water_source_secured === false) parts.push("⚠ source NOT secured");
    return parts.join(" · ") || "Optional — add known property and access details";
  })();

  return (
    <div className="bg-tint border border-edge2 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-ink text-sm font-semibold">Property details</h3>
          <p className="text-ink-2 text-xs mt-0.5">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-info hover:text-info-deep text-xs font-medium"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Ceiling height (ft)">
            <input
              type="number"
              min="6"
              max="30"
              step="0.5"
              value={inputs.ceiling_height_ft ?? ""}
              placeholder="8"
              onChange={(e) =>
                update("ceiling_height_ft", e.target.value ? Number(e.target.value) : undefined)
              }
              className={INPUT}
            />
          </Field>

          <Field label="Property type">
            <select
              value={inputs.property_type ?? ""}
              onChange={(e) => update("property_type", (e.target.value || undefined) as any)}
              className={INPUT}
            >
              <option value="">Select…</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="multi_family">Multi-family</option>
            </select>
          </Field>

          <Field label="Year built">
            <input
              type="text"
              value={inputs.year_built ?? ""}
              placeholder="e.g. 1985 or pre-1980"
              onChange={(e) => update("year_built", e.target.value || undefined)}
              className={INPUT}
            />
          </Field>

          <Field label="Stories">
            <input
              type="number"
              min="1"
              max="10"
              value={inputs.stories ?? ""}
              placeholder="1"
              onChange={(e) =>
                update("stories", e.target.value ? Number(e.target.value) : undefined)
              }
              className={INPUT}
            />
          </Field>

          <Field label="Water source">
            <select
              value={
                inputs.water_source_secured === undefined
                  ? ""
                  : inputs.water_source_secured
                    ? "yes"
                    : "no"
              }
              onChange={(e) =>
                update(
                  "water_source_secured",
                  e.target.value === "" ? undefined : e.target.value === "yes"
                )
              }
              className={INPUT}
            >
              <option value="">Select…</option>
              <option value="yes">Secured / shut off</option>
              <option value="no">Still flowing</option>
            </select>
          </Field>

          <div className="col-span-2">
            <Field label="Access / site notes">
              <input
                type="text"
                value={inputs.access_notes ?? ""}
                placeholder="e.g. gate code 1234, dog on premises, narrow stairs"
                onChange={(e) => update("access_notes", e.target.value || undefined)}
                className={INPUT}
              />
            </Field>
          </div>

          <div className="col-span-2 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {pending ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      )}

      {savedAt && !open && (
        <p className="text-pine text-xs mt-2">✓ Saved</p>
      )}
    </div>
  );
}

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-card border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-ink-2 text-xs uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
