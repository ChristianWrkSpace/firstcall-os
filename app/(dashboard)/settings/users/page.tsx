import { createAdminClient } from "@/lib/supabase-server";
import { accountActiveResultFromSnapshot, type AccountActiveSnapshot } from "@/lib/account-active-transitions";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ROLE_META, ALL_ROLES, type Role } from "@/lib/permissions";
import UserRoleEditor from "./UserRoleEditor";
import InviteUserForm from "./InviteUserForm";

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
  const { data: transitionRows } = await admin.rpc("list_latest_account_active_transitions", {});
  const transitionByProfile = new Map<string, ReturnType<typeof accountActiveResultFromSnapshot>>();
  for (const row of (Array.isArray(transitionRows) ? transitionRows : []) as AccountActiveSnapshot[]) {
    if (row && typeof row.target_profile_id === "string") {
      transitionByProfile.set(row.target_profile_id, accountActiveResultFromSnapshot(row));
    }
  }

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
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Users & Permissions</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          Role determines what each person can see and do.
        </p>
      </div>

      {canManage ? (
        <InviteUserForm />
      ) : (
        <div className="mb-5 px-4 py-3 bg-tint border border-edge2 rounded-lg text-ink-2 text-sm">
          ℹ️ View-only — only Owners can invite users or change roles.
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_META[r];
          return (
            <div key={r} className="glass-card p-4">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-ink text-sm font-semibold">{meta.label}</p>
                <p className="text-2xl font-bold text-info font-mono">
                  {counts[r]}
                </p>
              </div>
              <p className="text-ink-3 text-xs leading-snug">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {/* User table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
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
                className={`border-b border-edge2 last:border-0 ${
                  !p.active ? "opacity-50" : ""
                }`}
              >
                <td className="px-5 py-3 text-ink">
                  {p.name}
                  {p.id === me.id && (
                    <span className="ml-2 text-[10px] text-info uppercase tracking-wider">
                      you
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink-2 text-xs">{p.email ?? "—"}</td>
                <td className="px-5 py-3">
                  <UserRoleEditor
                    profileId={p.id}
                    currentRole={p.role}
                    canEdit={canManage && p.id !== me.id}
                    isActive={p.active}
                    initialTransition={transitionByProfile.get(p.id) ?? null}
                  />
                </td>
                <td className="px-5 py-3 text-ink-2 text-xs">
                  {p.active ? (
                    <span className="text-pine">active</span>
                  ) : (
                    <span className="text-ink-3">deactivated</span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink-3 text-xs">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 bg-card border border-edge2 rounded-lg p-4 text-ink-3 text-xs leading-relaxed">
        <p className="text-ink-2 text-sm font-semibold mb-1">How users join</p>
        <p>
          Invite them above — they get an email link, set a password, and land with
          the role you picked. (Self-signup via the login page still works and starts
          as <code className="text-ink-2 bg-shade px-1 rounded">technician</code>.)
        </p>
      </div>
    </div>
  );
}
