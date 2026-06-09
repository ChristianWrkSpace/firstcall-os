"use client";

import { useActionState } from "react";
import { inviteUser } from "@/app/actions/users";
import { ALL_ROLES, ROLE_META } from "@/lib/permissions";

const inputStyle = {
  backgroundColor: "rgba(58,47,38,0.05)",
  border: "1px solid var(--color-edge)",
  color: "var(--color-text-primary)",
} as const;

export default function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUser, undefined);

  return (
    <form
      action={action}
      className="rounded-2xl border p-4 md:p-5 mb-6"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}
    >
      <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
        Invite someone
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          name="name"
          required
          placeholder="Full name"
          autoComplete="off"
          className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 min-h-[44px]"
          style={inputStyle}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="email@firstcallm.com"
          autoComplete="off"
          className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 min-h-[44px]"
          style={inputStyle}
        />
        <select
          name="role"
          defaultValue="technician"
          className="px-3 py-2.5 rounded-xl text-sm capitalize focus:outline-none focus:ring-2 focus:ring-[#D97757]/40 min-h-[44px] cursor-pointer"
          style={inputStyle}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_META[r].label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          style={{ background: "linear-gradient(135deg, #E08A63, #C4663F)" }}
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
      {state?.error && (
        <p className="text-red-700 text-xs mt-2.5">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-xs mt-2.5" style={{ color: "#D97757" }}>
          ✓ {state.message}
        </p>
      )}
      <p className="text-[11px] mt-2.5" style={{ color: "var(--color-text-muted)" }}>
        They get an email link, set their own password, and land with the role you picked.
      </p>
    </form>
  );
}
