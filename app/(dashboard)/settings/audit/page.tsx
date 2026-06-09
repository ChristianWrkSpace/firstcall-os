import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";

const ACTION_META: Record<string, { emoji: string; color: string }> = {
  "invoice.sent":         { emoji: "✉",  color: "text-blue-400" },
  "invoice.voided":       { emoji: "✗",  color: "text-red-400" },
  "payment.recorded":     { emoji: "💰", color: "text-green-400" },
  "user.role_changed":    { emoji: "🔑", color: "text-yellow-400" },
  "user.activated":       { emoji: "✓",  color: "text-green-400" },
  "user.deactivated":     { emoji: "⏸",  color: "text-zinc-400" },
};

export default async function AuditPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!hasPermission(me.role, "audit.view")) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-red-400">Access denied. Only Owners and Managers can view audit logs.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Audit Log</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Sensitive actions (invoice send/void, payments, role changes). Latest 200 events.
        </p>
      </div>

      {!logs?.length ? (
        <div className="glass-card p-8 text-center">
          <p className="text-zinc-500 text-sm">No audit events yet.</p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">When</th>
                <th className="px-5 py-3 text-left">Who</th>
                <th className="px-5 py-3 text-left">Action</th>
                <th className="px-5 py-3 text-left">Entity</th>
                <th className="px-5 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => {
                const meta = ACTION_META[log.action] ?? {
                  emoji: "•",
                  color: "text-zinc-300",
                };
                return (
                  <tr
                    key={log.id}
                    className="border-b border-white/[0.06]/60 last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-5 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-zinc-200 text-xs">
                      {log.user_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${meta.color}`}>
                        {meta.emoji} {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs font-mono">
                      {log.entity_type ?? "—"}
                      {log.entity_id && (
                        <span className="text-zinc-600">
                          {" "}
                          {log.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs max-w-md">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <code className="text-[10px] break-all">
                          {JSON.stringify(log.details)}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
