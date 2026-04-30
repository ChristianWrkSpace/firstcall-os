"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { headers } from "next/headers";

export async function signIn(
  prevState: { error?: string } | undefined,
  formData: FormData
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createServerSupabaseClient();
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    `https://${hdrs.get("host") ?? "firstcall-os.vercel.app"}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  // Always return ok to prevent email enumeration
  if (error) {
    console.error("[requestPasswordReset]", error);
  }
  return { ok: true };
}

export async function updatePassword(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { ok: true };
}
