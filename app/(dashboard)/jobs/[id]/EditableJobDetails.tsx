"use client";

import { useState, useTransition } from "react";
import { updateJobIntake, type JobIntakePatch } from "@/app/actions/jobs";
import { JOB_TYPES } from "@/lib/constants";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-card border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm";
const LABEL = "text-ink-2 text-xs uppercase tracking-wide mb-0.5";

export interface EditableJobDetails {
  type: string;
  description: string | null;
  site_address: string | null;
  site_city: string | null;
  site_state: string | null;
  site_zip: string | null;
}

export default function EditableJobDetailsCard({
  jobId,
  job,
}: {
  jobId: string;
  job: EditableJobDetails;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<JobIntakePatch>({
    type: job.type,
    description: job.description,
    site_address: job.site_address,
    site_city: job.site_city,
    site_state: job.site_state,
    site_zip: job.site_zip,
  });

  function update<K extends keyof JobIntakePatch>(key: K, value: JobIntakePatch[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateJobIntake(jobId, draft);
      if ("error" in res) setError(res.error);
      else setEditing(false);
    });
  }

  function cancel() {
    setDraft({
      type: job.type,
      description: job.description,
      site_address: job.site_address,
      site_city: job.site_city,
      site_state: job.site_state,
      site_zip: job.site_zip,
    });
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink font-semibold">Job Details</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-info hover:text-info-deep text-xs font-medium"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Field label="Site Address" value={job.site_address} />
          <Field
            label="City / State / Zip"
            value={[job.site_city, job.site_state, job.site_zip]
              .filter(Boolean)
              .join(", ")}
          />
          <Field label="Type" value={job.type} capitalize />

          {job.description && (
            <div className="col-span-2">
              <p className={LABEL}>Description</p>
              <p className="text-ink">{job.description}</p>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-ink font-semibold">Edit Job Details</h2>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-ink-3 hover:text-ink text-xs font-medium"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldEdit label="Damage Type *">
          <select
            value={draft.type ?? ""}
            onChange={(e) => update("type", e.target.value)}
            className={INPUT}
          >
            {JOB_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FieldEdit>

        <FieldEdit label="State">
          <input
            value={draft.site_state ?? ""}
            onChange={(e) => update("site_state", e.target.value.toUpperCase().slice(0, 2))}
            className={INPUT}
            maxLength={2}
            placeholder="TX"
          />
        </FieldEdit>

        <div className="col-span-1 sm:col-span-2">
          <FieldEdit label="Site Address">
            <input
              value={draft.site_address ?? ""}
              onChange={(e) => update("site_address", e.target.value)}
              className={INPUT}
              placeholder="5800 Manchaca Rd"
            />
          </FieldEdit>
        </div>

        <FieldEdit label="City">
          <input
            value={draft.site_city ?? ""}
            onChange={(e) => update("site_city", e.target.value)}
            className={INPUT}
            placeholder="Austin"
          />
        </FieldEdit>

        <FieldEdit label="Zip">
          <input
            value={draft.site_zip ?? ""}
            onChange={(e) => update("site_zip", e.target.value)}
            className={INPUT}
            placeholder="78701"
          />
        </FieldEdit>

        <div className="col-span-1 sm:col-span-2">
          <FieldEdit label="Description">
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className={`${INPUT} resize-none`}
              placeholder="Brief description of the damage…"
            />
          </FieldEdit>
        </div>

        {error && (
          <div className="col-span-1 sm:col-span-2">
            <p className="text-red-700 text-xs bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
              {error}
            </p>
          </div>
        )}

        <div className="col-span-1 sm:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className={`text-ink ${capitalize ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function FieldEdit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}
