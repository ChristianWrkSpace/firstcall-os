"use client";

import { useState, useTransition } from "react";
import {
  setScheduledAt,
  assignTech,
  unassignTech,
  setLeadTech,
} from "@/app/actions/scheduling";

interface Profile {
  id: string;
  name: string;
  role: string;
}

interface Assignment {
  id: string;
  profile_id: string;
  profiles?: { name: string } | null;
}

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-cta";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export default function SchedulingPanel({
  jobId,
  scheduledAt,
  leadTechId,
  assignments,
  availableTechs,
}: {
  jobId: string;
  scheduledAt: string | null;
  leadTechId: string | null;
  assignments: Assignment[];
  availableTechs: Profile[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState(toLocalInput(scheduledAt));
  const [techToAssign, setTechToAssign] = useState("");

  function handleSetSchedule() {
    setError(null);
    startTransition(async () => {
      const iso = scheduleValue ? new Date(scheduleValue).toISOString() : null;
      const res = await setScheduledAt(jobId, iso);
      if (res.error) setError(res.error);
    });
  }

  function handleClearSchedule() {
    setError(null);
    setScheduleValue("");
    startTransition(async () => {
      await setScheduledAt(jobId, null);
    });
  }

  function handleAssign() {
    if (!techToAssign) return;
    setError(null);
    startTransition(async () => {
      const res = await assignTech(jobId, techToAssign);
      if (res.error) setError(res.error);
      else setTechToAssign("");
    });
  }

  function handleUnassign(assignmentId: string) {
    setError(null);
    startTransition(async () => {
      await unassignTech(assignmentId, jobId);
    });
  }

  function handleSetLead(profileId: string) {
    setError(null);
    startTransition(async () => {
      await setLeadTech(jobId, profileId === "" ? null : profileId);
    });
  }

  // Available techs that aren't already assigned
  const assignedIds = new Set(assignments.map((a) => a.profile_id));
  const remainingTechs = availableTechs.filter((t) => !assignedIds.has(t.id));

  const scheduledLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Schedule */}
      <div className="flex flex-col gap-1.5">
        <label className="text-ink-2 text-xs uppercase tracking-wide">
          Scheduled For
        </label>
        {scheduledLabel ? (
          <p className="text-ink text-sm font-medium">{scheduledLabel}</p>
        ) : (
          <p className="text-ink-3 text-sm italic">Not scheduled</p>
        )}
        <div className="flex gap-2 mt-1">
          <input
            type="datetime-local"
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSetSchedule}
            disabled={pending || !scheduleValue}
            className="px-3 py-1.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-xs rounded-lg flex-1"
          >
            {pending ? "Saving…" : scheduledAt ? "Update" : "Schedule"}
          </button>
          {scheduledAt && (
            <button
              onClick={handleClearSchedule}
              disabled={pending}
              className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-xs rounded-lg"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Assigned techs */}
      <div className="border-t border-edge2 pt-3">
        <label className="text-ink-2 text-xs uppercase tracking-wide block mb-2">
          Assigned Techs
        </label>
        {assignments.length === 0 ? (
          <p className="text-ink-3 text-xs italic mb-2">No techs assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-2">
            {assignments.map((a) => {
              const isLead = a.profile_id === leadTechId;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 bg-tint rounded px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-ink truncate">
                      {a.profiles?.name ?? "—"}
                    </span>
                    {isLead && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-info/10 text-info rounded">
                        LEAD
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isLead && (
                      <button
                        onClick={() => handleSetLead(a.profile_id)}
                        disabled={pending}
                        className="text-info hover:text-info-deep text-[10px]"
                      >
                        make lead
                      </button>
                    )}
                    <button
                      onClick={() => handleUnassign(a.id)}
                      disabled={pending}
                      className="text-red-700 hover:text-red-700 text-[10px]"
                    >
                      remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {remainingTechs.length > 0 && (
          <div className="flex gap-2">
            <select
              value={techToAssign}
              onChange={(e) => setTechToAssign(e.target.value)}
              className={INPUT + " flex-1"}
            >
              <option value="">Select a tech…</option>
              {remainingTechs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.role !== "technician" && `(${t.role})`}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssign}
              disabled={pending || !techToAssign}
              className="px-3 py-1.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-xs rounded-lg"
            >
              + Add
            </button>
          </div>
        )}
        {availableTechs.length === 0 && (
          <p className="text-ink-3 text-[10px] italic">
            No techs in the system yet — add profiles via Supabase auth.
          </p>
        )}
      </div>

      {error && <p className="text-red-700 text-xs">{error}</p>}
    </div>
  );
}
