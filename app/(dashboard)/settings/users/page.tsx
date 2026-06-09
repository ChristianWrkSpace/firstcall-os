import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ROLE_META, ALL_ROLES, type Role } from "@/lib/permissions";
import UserRoleEditor from "./UserRoleEditor";
import { PageShell, Glass } from "@/components/ui/Glass";

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
    <PageShell
      eyebrow="Settings"
      title="Users & Permissions"
      subtitle="Role determines what each person can see and do."
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="full"
    >
      {!canManage && (
        <div className="mb-5 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/45 text-sm">
          ℹ️ View-only — only Owners can change roles.
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_META[r];
          return (
            <Glass key={r} className="p-4">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-white/90 text-sm font-semibold">{meta.label}</p>
                <p className="text-2xl font-bold text-[#A6B8E7] font-mono">{counts[r]}</p>
              </div>
              <p className="text-white/40 text-xs leading-snug">{meta.description}</p>
            </Glass>
          );
        })}
      </div>

      {/* User table */}
      <Glass className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
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
                className={`border-b border-white/[0.06] last:border-0 ${
                  !p.active ? "opacity-50" : ""
                }`}
              >
                <td className="px-5 py-3 text-white/90">
                  {p.name}
                  {p.id === me.id && (
                    <span className="ml-2 text-[10px] text-[#A6B8E7] uppercase tracking-wider">
                      you
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-white/45 text-xs">{p.email ?? "—"}</td>
                <td className="px-5 py-3">
                  <UserRoleEditor
                    profileId={p.id}
                    currentRole={p.role}
                    canEdit={canManage && p.id !== me.id}
                    isActive={p.active}
                  />
                </td>
                <td className="px-5 py-3 text-white/45 text-xs">
                  {p.active ? (
                    <span className="text-emerald-300">active</span>
                  ) : (
                    <span className="text-white/40">deactivated</span>
                  )}
                </td>
                <td className="px-5 py-3 text-white/40 text-xs">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>

      <Glass subtle className="mt-5 p-4 text-white/40 text-xs leading-relaxed">
        <p className="text-white/70 text-sm font-semibold mb-1">How users join</p>
        <p>
          New users sign up via the standard login page. They start as{" "}
          <code className="text-white/70 bg-white/10 px-1 rounded">technician</code> by
          default. An Owner promotes them here once verified.
        </p>
      </Glass>
    </PageShell>
  );
}
