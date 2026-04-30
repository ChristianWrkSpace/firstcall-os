import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">FC</span>
          </div>
          <div>
            <p className="text-white font-semibold leading-none">FirstCall OS</p>
            <p className="text-zinc-500 text-xs mt-0.5">Set a new password</p>
          </div>
        </div>

        {user ? (
          <ResetPasswordForm email={user.email ?? null} />
        ) : (
          <div className="mt-2">
            <p className="text-zinc-300 text-sm leading-relaxed">
              This page only works after clicking the link in your password-reset
              email. If your link expired or you landed here directly, request a new
              one.
            </p>
            <Link
              href="/forgot-password"
              className="block mt-5 text-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Request a new link
            </Link>
            <Link
              href="/login"
              className="block mt-3 text-center text-zinc-500 hover:text-white text-xs"
            >
              ← Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
