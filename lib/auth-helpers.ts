import { cache } from "react";
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
 *
 * Wrapped in React.cache so the layout, page, and NotificationBell share one
 * auth + profile lookup per request instead of each paying both round-trips.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthedUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, email, role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active) return null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: (profile.role as Role) ?? "technician",
  };
});

/**
 * Require an authenticated user with an active profile.
 * Returns the project's standard action result shape.
 */
export async function requireAuthenticatedUser(): Promise<
  { user: AuthedUser } | { error: string }
> {
  const user = await getCurrentUser();
  return user ? { user } : { error: "Not authenticated." };
}

/**
 * Require an authenticated active user with a specific permission.
 * Returns the user if allowed, or an { error } object to bail with.
 */
export async function requirePermission(
  perm: Permission
): Promise<{ user: AuthedUser } | { error: string }> {
  const auth = await requireAuthenticatedUser();
  if ("error" in auth) return auth;
  if (!hasPermission(auth.user.role, perm)) {
    return { error: `Permission denied: ${perm} requires ${getRolesWithPermission(perm).join(", ")}.` };
  }
  return auth;
}

function getRolesWithPermission(perm: Permission): string[] {
  const roles: Role[] = ["owner", "manager", "office", "technician"];
  return roles.filter((r) => hasPermission(r, perm));
}
