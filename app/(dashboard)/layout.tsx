import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { navSectionsForRole, navForRole } from "@/lib/nav";
import { getCurrentUser } from "@/lib/auth-helpers";
import Logo from "@/components/Logo";
import MobileNav from "./MobileNav";
import CommandPalette from "./CommandPalette";
import SearchTrigger from "./SearchTrigger";
import NotificationBell from "./NotificationBell";
import InstallPrompt from "./InstallPrompt";
import SidebarNav from "./SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sections = navSectionsForRole(me.role);
  const items = navForRole(me.role);

  return (
    <div className="md:flex md:h-screen app-backdrop md:overflow-hidden">
      <CommandPalette />
      <MobileNav items={items} />
      <NotificationBell />
      <aside className="hidden md:flex w-56 flex-col shrink-0" style={{ backgroundColor: "var(--color-surface)", backdropFilter: "blur(14px)", borderRight: "1px solid var(--color-edge)" }}>
        <div className="flex flex-col gap-1 px-4 py-5" style={{ borderBottom: "1px solid var(--color-edge)" }}>
          <Logo variant="banner" size={32} priority />
          <p className="text-[color:var(--color-text-muted)] text-[10px] uppercase tracking-[0.18em] mt-1.5">FirstCall OS</p>
        </div>
        <SearchTrigger />
        <SidebarNav sections={sections} />
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <p className="text-[color:var(--color-text-muted)] text-[10px] uppercase tracking-[0.18em] truncate">{me.name} · {me.role}</p>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] shrink-0" />
          </div>
        </div>
        <div className="px-2 py-3" style={{ borderTop: "1px solid var(--color-edge)" }}>
          <form action={signOut}>
            <button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-strong)] transition-colors text-sm text-left">
              <span className="text-base leading-none">→</span>Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 md:overflow-auto relative">
        <InstallPrompt />
        {children}
      </main>
    </div>
  );
}
