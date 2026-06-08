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
import { AmbientShell } from "@/components/layout/ambient-shell";
import { SpatialSidebar } from "@/components/layout/spatial-sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sections = navSectionsForRole(me.role);
  const items = navForRole(me.role);

  return (
    <>
      <CommandPalette />
      <MobileNav items={items} />
      <AmbientShell
        sidebar={
          <SpatialSidebar sections={sections} activePath=""
            logo={<div className="flex flex-col gap-1"><Logo variant="banner" size={32} priority /><p className="text-[color:var(--color-text-muted)] text-[10px] uppercase tracking-[0.18em] mt-1.5">FirstCall OS</p></div>}
            footer={<div className="space-y-3">
              <div className="flex items-center justify-between"><p className="text-[color:var(--color-text-muted)] text-[10px] uppercase tracking-[0.18em] truncate">{me.name} · {me.role}</p><div className="w-1.5 h-1.5 rounded-full bg-[#5FBDB0]" /></div>
              <form action={signOut}><button type="submit" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)] transition-colors text-sm text-left"><span className="text-base leading-none">→</span>Sign out</button></form>
            </div>} />
        }
        topBar={<div className="flex items-center justify-between w-full"><SearchTrigger /><div className="flex items-center gap-4"><NotificationBell /><Logo variant="mark" size={20} /></div></div>}
      >
        <InstallPrompt />
        {children}
      </AmbientShell>
    </>
  );
}
