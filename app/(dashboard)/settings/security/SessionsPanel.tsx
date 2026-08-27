"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOutOtherSessions } from "@/app/actions/sessions";

interface UserSession {
  id: string;
  email: string | null;
  name: string;
  role: string;
  active: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}

const fmtAgo = (iso: string | null) => {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

export default function SessionsPanel({
  ownerView,
  users,
  currentUserId,
}: {
  ownerView: boolean;
  users: UserSession[];
  currentUserId: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function signOutOthers() {
    if (
      !confirm(
        "Sign out from all other devices/browsers? You'll stay signed in here."
      )
    )
      return;
    setMsg(null);
    start(async () => {
      const res = await signOutOtherSessions();
      if (res.error) setMsg(res.error);
      else {
        setMsg("✓ All other sessions signed out.");
        router.refresh();
      }
    });
  }


  return (
    <section className="glass-card p-5 mt-6">
      <h2 className="text-ink font-semibold mb-1">Sessions</h2>
      <p className="text-ink-3 text-xs mb-4 leading-relaxed">
        Suspect your password leaked? Sign out everywhere and rotate it.
      </p>

      <button
        type="button"
        onClick={signOutOthers}
        disabled={pending}
        className="px-4 py-2 bg-shade hover:bg-shade border border-edge2 disabled:opacity-50 text-ink text-sm font-medium rounded-lg"
      >
        {pending ? "Signing out…" : "🚪 Sign out everywhere except here"}
      </button>
      {msg && <p className="text-ink-2 text-xs mt-2">{msg}</p>}

      {ownerView && (
        <div className="mt-6 pt-6 border-t border-edge2">
          <h3 className="text-ink text-sm font-semibold mb-2">
            All Org Users (Owner-only)
          </h3>
          <p className="text-ink-3 text-xs mb-3 leading-relaxed">
            Last sign-in per user. To contain a compromised or departed account,
            use the canonical activation/deactivation workflow in{" "}
            <Link href="/settings/users" className="text-info hover:underline">
              Users &amp; Permissions
            </Link>
            . Deactivation keeps application access inactive until Auth blocking is confirmed.
          </p>
          <ul className="flex flex-col gap-1.5">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-tint border border-edge2 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-ink text-sm font-medium truncate">{u.name}</p>
                    <span className="text-ink-3 text-xs capitalize">{u.role}</span>
                    {!u.active && (
                      <span className="text-honey text-[10px] uppercase tracking-wide">
                        deactivated
                      </span>
                    )}
                    {u.id === currentUserId && (
                      <span className="text-info text-[10px] uppercase tracking-wide">
                        you
                      </span>
                    )}
                  </div>
                  <p className="text-ink-3 text-xs truncate">
                    {u.email} · last sign-in {fmtAgo(u.lastSignInAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
