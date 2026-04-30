import { createServerSupabaseClient, createAdminClient } from "./supabase-server";
import { hasPermission, type Permission, type Role } from "./permissions";

export interface AuthedUser {
  id: string;
  email: string | null;
  name: string;
  role: Role;
}

/**
 * Get the current authenticated user with their profile + role.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.email ?? "User",
      role: "technician", // fallback to least-privileged
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: (profile.role as Role) ?? "technician",
  };
}

/**
 * Require an authenticated user with a specific permission.
 * Returns the user if allowed, or an { error } object to bail with.
 */
export async function requirePermission(
  perm: Permission
): Promise<{ user: AuthedUser } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!hasPermission(user.role, perm)) {
    return { error: `Permission denied: ${perm} requires ${getRolesWithPermission(perm).join(", ")}.` };
  }
  return { user };
}

function getRolesWithPermission(perm: Permission): string[] {
  const roles: Role[] = ["owner", "manager", "office", "technician"];
  return roles.filter((r) => hasPermission(r, perm));
}
