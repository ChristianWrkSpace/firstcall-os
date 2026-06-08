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
  if (!me) redirect("/login");
  const sections = navSectionsForRole(me.role);
  const items = navForRole(me.role);

  return (
    <div className="md:flex md:h-screen app-backdrop md:overflow-hidden">
      <CommandPalette />
      <MobileNav items={items} />
      <div className="hidden md:block fixed top-4 right-5 z-30 pointer-events-none opacity-90">
        <Logo variant="mark" size={32} />
      </div>
      <NotificationBell />
      <aside className="hidden md:flex w-56 flex-col shrink-0"
        style={{ backgroundColor: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-col gap-1 px-4 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Logo variant="banner" size={32} priority />
          <p className="text-white/40 text-[10px] uppercase tracking-[0.18em] mt-1.5">FirstCall OS</p>
        </div>
        <SearchTrigger />
        <SidebarNav sections={sections} />
        <div className="px-4 pb-3">
          <p className="text-white/35 text-[10px] uppercase tracking-[0.18em] truncate">{me.name} · {me.role}</p>
        </div>
        <div className="px-2 py-3 border-t border-white/[0.06]">
          <form action={signOut}>
            <button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors text-sm text-left">
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
