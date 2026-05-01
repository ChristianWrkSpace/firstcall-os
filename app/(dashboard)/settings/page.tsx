import { getCurrentUser } from "@/lib/auth-helpers";
import { hasPermission, ROLE_META, type Role } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const cards: Array<{
    href: string;
    title: string;
    description: string;
    emoji: string;
    visible: boolean;
  }> = [
    {
      href: "/settings/users",
      title: "Users & Permissions",
      description: "Manage roles for everyone with access to the system.",
      emoji: "👥",
      visible: true,
    },
    {
      href: "/settings/audit",
      title: "Audit Log",
      description: "Track sensitive actions: invoices, payments, role changes.",
      emoji: "📜",
      visible: hasPermission(me.role, "audit.view"),
    },
    {
      href: "/settings/backups",
      title: "Backups & DR",
      description:
        "Weekly auto-export, manual trigger, restore drill checklist.",
      emoji: "💾",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/incident-response",
      title: "Incident Response",
      description:
        "Leak playbook, breach-notification (TX § 521.053), vendor compromise.",
      emoji: "🚨",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/secrets-rotation",
      title: "Secrets Rotation",
      description:
        "Rotation cadence + status for every API key. Mark rotated to reset clock.",
      emoji: "🔑",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/pii-inventory",
      title: "PII Inventory",
      description:
        "Data dictionary, retention policy, customer-deletion request flow.",
      emoji: "🗂",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/system-health",
      title: "System Health",
      description:
        "30-second health check: agent activity, failed sends, audits, backups, recursive feedback.",
      emoji: "❤️‍🩹",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/cost-basis",
      title: "Cost Basis",
      description:
        "Hourly rate, van $/job, equipment daily cost, monthly overhead. Drives every Job P&L computation.",
      emoji: "🧮",
      visible: me.role === "owner" || me.role === "manager",
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Signed in as <span className="text-zinc-200">{me.name}</span> ·{" "}
          <span className="text-blue-400 capitalize">
            {ROLE_META[me.role as Role]?.label ?? me.role}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards
          .filter((c) => c.visible)
          .map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="text-2xl mb-2">{c.emoji}</div>
              <h2 className="text-white font-semibold">{c.title}</h2>
              <p className="text-zinc-500 text-sm mt-1 leading-snug">
                {c.description}
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}
