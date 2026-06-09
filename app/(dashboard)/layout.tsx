import { redirect } from "next/navigation";
import { navForRole, dockForRole } from "@/lib/nav";
import { getCurrentUser } from "@/lib/auth-helpers";
import MobileNav from "./MobileNav";
import CommandPalette from "./CommandPalette";
import NotificationBell from "./NotificationBell";
import InstallPrompt from "./InstallPrompt";
import AppDock from "./AppDock";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  // No silent technician fallback — if auth fails here, send to login so
  // bugs surface as redirects rather than as a silently-downgraded nav.
  if (!me) redirect("/login");
  const items = navForRole(me.role);     // full long tail — palette + mobile drawer
  const dock = dockForRole(me.role);     // the few primary verbs on the dock

  return (
    <div className="md:flex md:h-screen app-backdrop md:overflow-hidden">
      {/* Command-first navigation: ⌘K palette navigates anywhere by intent.
          The 20-item rail is gone — see AppDock + SidebarNav.tsx (preserved). */}
      <CommandPalette navItems={items} />

      {/* Mobile drawer (sticky top bar + slide-out) */}
      <MobileNav items={items} />

      {/* Notification bell — pending approvals count */}
      <NotificationBell />

      {/* Desktop: whisper-thin command dock hugging the left edge */}
      <AppDock items={dock} me={{ name: me.name, role: me.role }} />

      {/* Main content */}
      <main className="flex-1 md:overflow-auto relative">
        <InstallPrompt />
        {children}
      </main>
    </div>
  );
}
