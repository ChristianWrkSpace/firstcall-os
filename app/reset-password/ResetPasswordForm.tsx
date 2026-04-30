"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/app/actions/auth";

export default function ResetPasswordForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => router.push("/dashboard"), 1500);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  if (state?.ok) {
    return (
      <div className="mt-2 px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-lg text-sm">
        ✓ Password updated. Redirecting to dashboard…
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 mt-2">
      {email && (
        <p className="text-zinc-400 text-sm">
          Setting new password for <span className="text-white">{email}</span>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-300 text-sm">New password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          autoComplete="new-password"
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
          autoComplete="new-password"
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
        />
      </div>
      {state?.error && <p className="text-red-400 text-xs">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
