import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireRoles } from "@/components/RoleGate";
import { PageShell, Glass } from "@/components/ui/Glass";

const SECURITY_ACTIONS = [
  "session.signout_others",
  "session.force_signout",
  "mfa.enrolled",
  "mfa.unenrolled",
  "rate_limit.hit",
  "auth.failed_login",
  "auth.password_reset",
  "customer.pii_redacted",
  "secret.rotated",
  "backup.drill_verify",
  "backup.downloaded",
];

const ACTION_META: Record<string, { color: string; emoji: string }> = {
  "session.signout_others":  { color: "text-[#A6B8E7]",    emoji: "🚪" },
  "session.force_signout":   { color: "text-red-300",      emoji: "🚫" },
  "mfa.enrolled":            { color: "text-emerald-300",  emoji: "🔐" },
  "mfa.unenrolled":          { color: "text-amber-300",    emoji: "🔓" },
  "rate_limit.hit":          { color: "text-amber-300",    emoji: "🚦" },
  "auth.failed_login":       { color: "text-red-300",      emoji: "❌" },
  "auth.password_reset":     { color: "text-[#A6B8E7]",    emoji: "🔑" },
  "customer.pii_redacted":   { color: "text-purple-300",   emoji: "🗑️" },
  "secret.rotated":          { color: "text-emerald-300",  emoji: "🔄" },
  "backup.drill_verify":     { color: "text-emerald-300",  emoji: "🔍" },
  "backup.downloaded":       { color: "text-[#A6B8E7]",    emoji: "📥" },
  "default":                 { color: "text-white/45",     emoji: "📜" },
};

const fmtAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

const NDAYS_AGO = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const filterActive = "bg-white/[0.08] text-white ring-1 ring-[#5FBDB0]/25";
const filterIdle = "bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white";

export default async function SecurityActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  await requireRoles(["owner", "manager"]);
  const params = await searchParams;
  const windowDays = Math.min(Math.max(parseInt(params.window ?? "7"), 1), 90);
  const since = NDAYS_AGO(windowDays);

  const supabase = await createServerSupabaseClient();
  const { data: events } = await supabase
    .from("audit_logs")
    .select("id, action, user_name, created_at, details, entity_type, entity_id")
    .in("action", SECURITY_ACTIONS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  // Aggregate counts per action
  const counts = new Map<string, number>();
  const rateLimitKeys = new Map<string, number>();
  for (const e of (events ?? []) as any[]) {
    counts.set(e.action, (counts.get(e.action) ?? 0) + 1);
    if (e.action === "rate_limit.hit" && e.details?.key) {
      rateLimitKeys.set(e.details.key, (rateLimitKeys.get(e.details.key) ?? 0) + 1);
    }
  }

  // Risk signals
  const signals: Array<{ severity: "high" | "med"; text: string }> = [];
  const failedLogins = counts.get("auth.failed_login") ?? 0;
  if (failedLogins > 20) {
    signals.push({
      severity: "high",
      text: `${failedLogins} failed login attempts in last ${windowDays}d — possible brute-force.`,
    });
  } else if (failedLogins > 5) {
    signals.push({
      severity: "med",
      text: `${failedLogins} failed login attempts in last ${windowDays}d — keep an eye on.`,
    });
  }
  const rlHits = counts.get("rate_limit.hit") ?? 0;
  if (rlHits > 50) {
    signals.push({
      severity: "high",
      text: `${rlHits} rate-limit hits — automated abuse, or a runaway agent loop.`,
    });
  }
  const mfaUnenroll = counts.get("mfa.unenrolled") ?? 0;
  if (mfaUnenroll > 0) {
    signals.push({
      severity: "med",
      text: `${mfaUnenroll} MFA factor${mfaUnenroll === 1 ? "" : "s"} removed in last ${windowDays}d — confirm those were intentional.`,
    });
  }
  const forceSignouts = counts.get("session.force_signout") ?? 0;
  if (forceSignouts > 0) {
    signals.push({
      severity: "med",
      text: `${forceSignouts} forced sign-out${forceSignouts === 1 ? "" : "s"} — owner action recorded.`,
    });
  }

  return (
    <PageShell
      eyebrow="Settings"
      title="Security Activity"
      subtitle="Auth events, MFA changes, rate-limit hits, secret rotations, backup drills. Sourced from the audit log."
      action={
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
          >
            ← Settings
          </Link>
          <div className="flex items-center gap-1">
            {[1, 7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/settings/security-activity?window=${d}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  windowDays === d ? filterActive : filterIdle
                }`}
              >
                {d === 1 ? "24h" : `${d}d`}
              </Link>
            ))}
          </div>
        </div>
      }
      width="wide"
    >
      {/* Risk signals */}
      {signals.length > 0 && (
        <Glass accent="amber" subtle className="p-4 mb-6">
          <p className="text-amber-300 text-xs uppercase tracking-wide font-semibold mb-2">
            ⚠ Signals worth checking
          </p>
          <ul className="space-y-1.5">
            {signals.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={s.severity === "high" ? "text-red-300" : "text-amber-300"}>●</span>
                <span className="text-white/80">{s.text}</span>
              </li>
            ))}
          </ul>
        </Glass>
      )}

      {/* Counts by action */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
        {Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([action, count]) => {
            const meta = ACTION_META[action] ?? ACTION_META.default;
            return (
              <div
                key={action}
                className="bg-white/[0.025] border border-white/[0.05] rounded-lg p-3 text-center"
              >
                <p className="text-xl">{meta.emoji}</p>
                <p className={`text-xl font-bold font-mono ${meta.color}`}>{count}</p>
                <p className="text-white/40 text-[10px] mt-0.5 truncate">
                  {action.replace(/[._]/g, " ")}
                </p>
              </div>
            );
          })}
      </div>

      {/* Rate-limit key breakdown */}
      {rateLimitKeys.size > 0 && (
        <Glass className="p-5 mb-6">
          <h2 className="text-white/90 font-semibold mb-3">🚦 Rate Limit Hits by Key</h2>
          <ul className="flex flex-col gap-1.5">
            {Array.from(rateLimitKeys.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([key, count]) => (
                <li
                  key={key}
                  className="flex items-center justify-between text-xs px-3 py-1.5 bg-white/[0.03] rounded"
                >
                  <code className="text-white/70 truncate">{key}</code>
                  <span className="text-amber-300 font-mono font-semibold">×{count}</span>
                </li>
              ))}
          </ul>
        </Glass>
      )}

      {/* Event stream */}
      <Glass className="p-5">
        <h2 className="text-white/90 font-semibold mb-3">Event Stream</h2>
        {!events?.length ? (
          <p className="text-white/40 text-sm italic">No security events in this window.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1">
            {events.map((e: any) => {
              const meta = ACTION_META[e.action] ?? ACTION_META.default;
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg"
                >
                  <span className="text-base shrink-0 leading-none mt-0.5">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${meta.color}`}>
                        {e.action.replace(/[._]/g, " ")}
                      </p>
                      <p className="text-white/40 text-[10px] font-mono">{fmtAgo(e.created_at)}</p>
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">
                      by {e.user_name ?? "system"}
                      {e.entity_type && ` · ${e.entity_type}`}
                    </p>
                    {e.details && Object.keys(e.details).length > 0 && (
                      <pre className="text-white/30 text-[10px] mt-1 overflow-x-auto">
                        {JSON.stringify(e.details, null, 2).slice(0, 200)}
                      </pre>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Glass>
    </PageShell>
  );
}
