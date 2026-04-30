import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ROLE_META, ALL_ROLES, type Role } from "@/lib/permissions";
import UserRoleEditor from "./UserRoleEditor";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  // Anyone can see the list, but only owners can edit
  const canManage = me.role === "owner";

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, role, active, created_at")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  const counts: Record<Role, number> = {
    owner: 0,
    manager: 0,
    office: 0,
    technician: 0,
  };
  for (const p of profiles ?? []) {
    if (p.active && p.role in counts) counts[p.role as Role] += 1;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Users & Permissions</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Role determines what each person can see and do.
        </p>
      </div>

      {!canManage && (
        <div className="mb-5 px-4 py-3 bg-zinc-800/40 border border-zinc-700/50 rounded-lg text-zinc-400 text-sm">
          ℹ️ View-only — only Owners can change roles.
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_META[r];
          return (
            <div key={r} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-white text-sm font-semibold">{meta.label}</p>
                <p className="text-2xl font-bold text-blue-400 font-mono">
                  {counts[r]}
                </p>
              </div>
              <p className="text-zinc-500 text-xs leading-snug">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {/* User table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p: any) => (
              <tr
                key={p.id}
                className={`border-b border-zinc-800 last:border-0 ${
                  !p.active ? "opacity-50" : ""
                }`}
              >
                <td className="px-5 py-3 text-white">
                  {p.name}
                  {p.id === me.id && (
                    <span className="ml-2 text-[10px] text-blue-400 uppercase tracking-wider">
                      you
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-400 text-xs">{p.email ?? "—"}</td>
                <td className="px-5 py-3">
                  <UserRoleEditor
                    profileId={p.id}
                    currentRole={p.role}
                    canEdit={canManage && p.id !== me.id}
                    isActive={p.active}
                  />
                </td>
                <td className="px-5 py-3 text-zinc-400 text-xs">
                  {p.active ? (
                    <span className="text-green-400">active</span>
                  ) : (
                    <span className="text-zinc-500">deactivated</span>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-500 text-xs">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">How users join</p>
        <p>
          New users sign up via the standard login page. They start as{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">technician</code> by
          default. An Owner promotes them here once verified.
        </p>
      </div>
    </div>
  );
}
