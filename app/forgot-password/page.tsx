"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-card p-4">
      <div className="w-full max-w-sm bg-card border border-edge2 rounded-2xl p-8">
        <div className="flex justify-center mb-6">
          <Logo variant="banner" size={40} priority />
        </div>

        <h1 className="text-xl font-bold text-ink">Reset your password</h1>
        <p className="text-ink-2 text-sm mt-1">
          Enter your email — we'll send a link to set a new password.
        </p>

        {state?.ok ? (
          <div className="mt-5 px-4 py-3 bg-pine/10 border border-green-500/30 text-pine rounded-lg text-sm">
            ✓ If that email exists in our system, a reset link is on the way. Check
            your inbox (and spam).
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3 mt-5">
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm"
            />
            {state?.error && (
              <p className="text-red-700 text-xs">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="text-ink-3 hover:text-ink text-xs mt-4 inline-block"
        >
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
