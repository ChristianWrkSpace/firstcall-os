"use client";

import { useActionState } from "react";
import { updateCostBasis } from "@/app/actions/cost-basis";
import type { CostBasis } from "@/lib/job-pnl";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-mono";
const LABEL = "text-zinc-300 text-sm font-medium";

export default function CostBasisForm({ initial }: { initial: CostBasis }) {
  const [state, action, pending] = useActionState(updateCostBasis, undefined);

  return (
    <form
      action={action}
      className="glass-card p-6 flex flex-col gap-5"
    >
      <Field
        label="Default hourly rate"
        name="default_hourly_rate"
        defaultValue={initial.default_hourly_rate}
        prefix="$"
        suffix="/ hr"
      />
      <Field
        label="Van cost per job"
        name="van_cost_per_job"
        defaultValue={initial.van_cost_per_job}
        prefix="$"
        suffix="/ job"
      />
      <Field
        label="Default equipment daily cost"
        name="default_equipment_daily"
        defaultValue={initial.default_equipment_daily}
        prefix="$"
        suffix="/ day"
      />
      <Field
        label="Monthly overhead"
        name="monthly_overhead"
        defaultValue={initial.monthly_overhead}
        prefix="$"
        suffix="/ mo"
      />

      {state?.error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
          ✓ Saved. New numbers apply to all P&L computations.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {pending ? "Saving…" : "Save Cost Basis"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  prefix,
  suffix,
}: {
  label: string;
  name: string;
  defaultValue: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL} htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
            {prefix}
          </span>
        )}
        <input
          id={name}
          name={name}
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaultValue}
          className={`${INPUT} ${prefix ? "pl-7" : ""} ${suffix ? "pr-16" : ""}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
