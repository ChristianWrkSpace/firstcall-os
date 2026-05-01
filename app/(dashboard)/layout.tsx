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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  // No silent technician fallback — if auth fails here, send to login so
  // bugs surface as redirects rather than as a silently-downgraded nav.
  if (!me) redirect("/login");
  const sections = navSectionsForRole(me.role);
  const items = navForRole(me.role); // flat list for the mobile drawer

  return (
    <div className="md:flex md:h-screen app-backdrop md:overflow-hidden">
      {/* Global Cmd+K palette — listens for keyboard or "open-command-palette" event */}
      <CommandPalette />

      {/* Mobile drawer (sticky top bar + slide-out) */}
      <MobileNav items={items} />

      {/* Top-right floating mark — visible on every dashboard page */}
      <div className="hidden md:block fixed top-4 right-5 z-30 pointer-events-none opacity-90">
        <Logo variant="mark" size={32} />
      </div>

      {/* Notification bell — pending approvals count */}
      <NotificationBell />

      {/* Desktop sidebar — glass panel hugging the left edge */}
      <aside className="hidden md:flex w-56 flex-col shrink-0 bg-white/[0.02] backdrop-blur-2xl border-r border-white/[0.06]">
        {/* Brand */}
        <div className="flex flex-col gap-1 px-4 py-5 border-b border-white/[0.06]">
          <Logo variant="banner" size={32} priority />
          <p className="text-white/40 text-[10px] uppercase tracking-[0.18em] mt-1.5">
            FirstCall OS
          </p>
        </div>

        {/* Search */}
        <SearchTrigger />

        {/* Nav — workflow-grouped sections, filtered to the user's role.
            SidebarNav is a client component so it can highlight the active
            route from usePathname(). */}
        <SidebarNav sections={sections} />

        {/* Role indicator + sign out */}
        <div className="px-4 pb-3">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.18em] truncate">
            {me.name} · {me.role}
          </p>
        </div>
        <div className="px-2 py-3 border-t border-white/[0.06]">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors text-sm text-left"
            >
              <span className="text-base leading-none">→</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:overflow-auto relative">
        <InstallPrompt />
        {children}
      </main>
    </div>
  );
}
