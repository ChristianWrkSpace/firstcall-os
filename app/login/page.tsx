"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--color-bg-base)] p-4">
      <div className="w-full max-w-sm px-8 py-10 rounded-lg border shadow-sm" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}>
        <div className="mb-8">
          <div className="flex justify-center mb-6"><Logo variant="banner" size={44} priority /></div>
          <h1 className="text-2xl font-bold text-center" style={{ color: "var(--color-text-primary)" }}>Sign in</h1>
          <p className="text-sm mt-1 text-center" style={{ color: "var(--color-text-muted)" }}>Austin, TX</p>
        </div>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="w-full px-3 py-2 rounded-xl text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/50 focus:border-transparent" style={{ backgroundColor: "var(--color-surface-strong)", border: "1px solid var(--color-edge)", color: "var(--color-text-primary)" }} placeholder="you@firstcallmitigation.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }} htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs hover:underline transition-colors" style={{ color: "var(--color-primary)" }}>Forgot?</Link>
            </div>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full px-3 py-2 rounded-xl text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/50 focus:border-transparent" style={{ backgroundColor: "var(--color-surface-strong)", border: "1px solid var(--color-edge)", color: "var(--color-text-primary)" }} placeholder="••••••••" />
          </div>
          {state?.error && (
            <div className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--color-danger)" }}>{state.error}</div>
          )}
          <button type="submit" disabled={pending} className="w-full py-2.5 rounded-[6px] bg-cta text-white font-medium text-sm transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cta-deep">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
