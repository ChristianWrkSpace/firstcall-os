import { getCurrentUser } from "@/lib/auth-helpers";
import { hasPermission, ROLE_META, type Role } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell, Glass } from "@/components/ui/Glass";

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
      description: "Weekly auto-export, manual trigger, restore drill checklist.",
      emoji: "💾",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/incident-response",
      title: "Incident Response",
      description: "Leak playbook, breach-notification (TX § 521.053), vendor compromise.",
      emoji: "🚨",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/secrets-rotation",
      title: "Secrets Rotation",
      description: "Rotation cadence + status for every API key. Mark rotated to reset clock.",
      emoji: "🔑",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/pii-inventory",
      title: "PII Inventory",
      description: "Data dictionary, retention policy, customer-deletion request flow.",
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
    {
      href: "/settings/price-book",
      title: "Unit Price Book",
      description:
        "Reviewed Xactimate code → unit price ground truth. Anchors Ledger so AI estimates stop drifting on every run.",
      emoji: "📒",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/ai-routing",
      title: "AI Routing",
      description:
        "Per-agent model overrides + cross-provider fallback chains. Swap any agent onto Gemini/DeepSeek without a redeploy.",
      emoji: "🛰",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/security",
      title: "Security (2FA)",
      description:
        "Two-factor authentication + session controls. Strongly recommended for owner + manager.",
      emoji: "🔒",
      visible: true,
    },
    {
      href: "/settings/security-activity",
      title: "Security Activity",
      description:
        "Auth events, MFA changes, rate-limit hits, secret rotations, backup drills. Surfaces brute-force + abuse signals.",
      emoji: "🛰️",
      visible: me.role === "owner" || me.role === "manager",
    },
    {
      href: "/settings/security-self-audit",
      title: "Pen-Test Engagement Packet",
      description:
        "OWASP Top 10 posture + architecture + auth model + high-risk surfaces. Print and hand to a pen-test firm at kickoff.",
      emoji: "🔐",
      visible: me.role === "owner",
    },
  ];

  return (
    <PageShell
      eyebrow="System"
      title="Settings"
      subtitle={
        <>
          Signed in as <span className="text-white/80">{me.name}</span> ·{" "}
          <span className="text-[#A8DCD3] capitalize">
            {ROLE_META[me.role as Role]?.label ?? me.role}
          </span>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards
          .filter((c) => c.visible)
          .map((c) => (
            <Link key={c.href} href={c.href} className="group block">
              <Glass className="p-5 h-full transition-all group-hover:bg-white/[0.05] group-hover:border-white/[0.12] animate-rise-in">
                <div className="text-2xl mb-2">{c.emoji}</div>
                <h2 className="text-white/95 font-semibold flex items-center gap-1.5">
                  {c.title}
                  <span className="text-white/20 group-hover:text-white/50 transition-colors">→</span>
                </h2>
                <p className="text-white/45 text-sm mt-1 leading-snug">{c.description}</p>
              </Glass>
            </Link>
          ))}
      </div>
    </PageShell>
  );
}
