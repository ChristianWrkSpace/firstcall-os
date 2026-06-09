import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell, Glass, EmptyState } from "@/components/ui/Glass";

const ACTION_META: Record<string, { emoji: string; color: string }> = {
  "invoice.sent":         { emoji: "✉",  color: "text-[#A6B8E7]" },
  "invoice.voided":       { emoji: "✗",  color: "text-red-300" },
  "payment.recorded":     { emoji: "💰", color: "text-emerald-300" },
  "user.role_changed":    { emoji: "🔑", color: "text-amber-300" },
  "user.activated":       { emoji: "✓",  color: "text-emerald-300" },
  "user.deactivated":     { emoji: "⏸",  color: "text-white/45" },
};

export default async function AuditPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!hasPermission(me.role, "audit.view")) {
    return (
      <PageShell eyebrow="Settings" title="Audit Log" width="narrow">
        <p className="text-red-300">Access denied. Only Owners and Managers can view audit logs.</p>
      </PageShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <PageShell
      eyebrow="Settings"
      title="Audit Log"
      subtitle="Sensitive actions (invoice send/void, payments, role changes). Latest 200 events."
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="full"
    >
      {!logs?.length ? (
        <EmptyState icon="📜" title="No audit events yet." />
      ) : (
        <Glass className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
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
                  color: "text-white/70",
                };
                return (
                  <tr
                    key={log.id}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-5 py-3 text-white/45 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-white/80 text-xs">
                      {log.user_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${meta.color}`}>
                        {meta.emoji} {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white/45 text-xs font-mono">
                      {log.entity_type ?? "—"}
                      {log.entity_id && (
                        <span className="text-white/30"> {log.entity_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-white/40 text-xs max-w-md">
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
        </Glass>
      )}
    </PageShell>
  );
}
