import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth-helpers";
import Logo from "@/components/Logo";
import { AmbientDock } from "@/components/layout/ambient-dock";

const DOCK_ITEMS = [
  { icon: "◉", label: "Canvas", href: "/canvas" },
  { icon: "☀️", label: "My Day", href: "/my-day" },
  { icon: "◈", label: "Jobs", href: "/jobs" },
  { icon: "✓", label: "Approvals", href: "/approvals" },
  { icon: "$", label: "Receivables", href: "/ar" },
  { icon: "◊", label: "Reports", href: "/reports" },
  { icon: "◇", label: "Settings", href: "/settings" },
];

export default async function CanvasLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg-deep)" }}>
      <header className="relative z-30 shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--color-edge)", backgroundColor: "rgba(14,16,18,0.7)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <Logo variant="mark" size={24} />
          <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--color-text-muted)]">FirstCall OS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-[color:var(--color-text-muted)]">{me.name} · {me.role}</span>
          <form action={signOut}>
            <button type="submit" className="text-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)] transition-colors">Sign out</button>
          </form>
        </div>
      </header>
      <div className="flex-1 pb-24">{children}</div>
      <AmbientDock items={DOCK_ITEMS.map(d => ({ ...d, active: d.href === "/canvas" }))} />
    </div>
  );
}
