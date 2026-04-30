"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/app/actions/auth";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => router.push("/dashboard"), 1500);
      return () => clearTimeout(t);
    }
  }, [state, router]);

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

        {state?.ok ? (
          <div className="mt-5 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-lg text-sm">
            ✓ Password updated. Redirecting to dashboard…
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3 mt-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-300 text-sm">New password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-300 text-sm">Confirm</label>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                placeholder="Same again"
                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              />
            </div>
            {state?.error && (
              <p className="text-red-400 text-xs">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {pending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
