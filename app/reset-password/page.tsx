import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import Logo from "@/components/Logo";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex items-center justify-center bg-card p-4">
      <div className="w-full max-w-sm bg-card border border-edge2 rounded-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <Logo variant="banner" size={40} priority />
          <p className="text-ink-3 text-xs mt-3">Set a new password</p>
        </div>

        {user ? (
          <ResetPasswordForm email={user.email ?? null} />
        ) : (
          <div className="mt-2">
            <p className="text-ink-2 text-sm leading-relaxed">
              This page only works after clicking the link in your password-reset
              email. If your link expired or you landed here directly, request a new
              one.
            </p>
            <Link
              href="/forgot-password"
              className="block mt-5 text-center px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg transition-colors"
            >
              Request a new link
            </Link>
            <Link
              href="/login"
              className="block mt-3 text-center text-ink-3 hover:text-ink text-xs"
            >
              ← Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
