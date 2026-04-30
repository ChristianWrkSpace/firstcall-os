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
