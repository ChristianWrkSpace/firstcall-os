"use client";

import { useState, useTransition } from "react";
import { changeUserRole, setUserActive } from "@/app/actions/users";
import { ALL_ROLES, ROLE_META, type Role } from "@/lib/permissions";

export default function UserRoleEditor({
  profileId,
  currentRole,
  canEdit,
  isActive,
}: {
  profileId: string;
  currentRole: string;
  canEdit: boolean;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as Role;
    if (newRole === currentRole) return;
    setError(null);
    startTransition(async () => {
      const res = await changeUserRole(profileId, newRole);
      if (res.error) setError(res.error);
    });
  }

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const res = await setUserActive(profileId, !isActive);
      if (res.error) setError(res.error);
    });
  }

  if (!canEdit) {
    return (
      <span className="capitalize text-zinc-300">
        {ROLE_META[currentRole as Role]?.label ?? currentRole}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentRole}
        onChange={onChange}
        disabled={pending}
        className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white text-xs capitalize cursor-pointer disabled:opacity-50"
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_META[r].label}
          </option>
        ))}
      </select>
      <button
        onClick={toggleActive}
        disabled={pending}
        className="text-zinc-500 hover:text-zinc-300 text-[10px]"
      >
        {isActive ? "deactivate" : "activate"}
      </button>
      {error && <span className="text-red-400 text-[10px]">{error}</span>}
    </div>
  );
}
