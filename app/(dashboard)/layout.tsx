import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { navSectionsForRole, navForRole } from "@/lib/nav";
import { getCurrentUser } from "@/lib/auth-helpers";
import Logo from "@/components/Logo";
import { SignOutIcon } from "@/components/icons/nav-icons";
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
      <Suspense fallback={<NotificationBellFallback />}>
        <NotificationBell />
      </Suspense>
      <aside className="hidden md:flex w-60 flex-col shrink-0 bg-[color:var(--color-bg-deep)] border-r border-[color:var(--color-edge)]">
        <div className="flex flex-col gap-1 px-4 py-5" style={{ borderBottom: "1px solid var(--color-edge)" }}>
          <Logo variant="banner" size={32} priority />
          <p className="text-[color:var(--color-text-muted)] text-xs mt-1.5">Field operations ledger</p>
        </div>
        <SearchTrigger />
        <SidebarNav sections={sections} />
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <p className="text-[color:var(--color-text-muted)] text-xs truncate">{me.name} · {me.role}</p>
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] shrink-0" />
          </div>
        </div>
        <div className="px-2 py-3" style={{ borderTop: "1px solid var(--color-edge)" }}>
          <form action={signOut}>
            <button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-strong)] transition-colors text-sm text-left">
              <SignOutIcon className="h-[18px] w-[18px] shrink-0" />Sign out
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

function NotificationBellFallback() {
  return (
    <div className="hidden md:block fixed top-4 right-20 z-30 h-8 w-14 rounded-[6px] bg-[color:var(--color-surface)] border border-[color:var(--color-edge)]" />
  );
}
