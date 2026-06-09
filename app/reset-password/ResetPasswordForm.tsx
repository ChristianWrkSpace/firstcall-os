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
      <div className="mt-2 px-4 py-3 bg-pine/10 border border-green-500/30 text-pine rounded-lg text-sm">
        ✓ Password updated. Redirecting to dashboard…
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 mt-2">
      {email && (
        <p className="text-ink-2 text-sm">
          Setting new password for <span className="text-ink">{email}</span>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-ink-2 text-sm">New password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          className="px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-ink-2 text-sm">Confirm</label>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          placeholder="Same again"
          autoComplete="new-password"
          className="px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm"
        />
      </div>
      {state?.error && <p className="text-red-700 text-xs">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
