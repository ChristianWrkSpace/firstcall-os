import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { navForRole } from "@/lib/nav";
import { getCurrentUser } from "@/lib/auth-helpers";
import Logo from "@/components/Logo";
import MobileNav from "./MobileNav";
import CommandPalette from "./CommandPalette";
import SearchTrigger from "./SearchTrigger";
import NotificationBell from "./NotificationBell";
import InstallPrompt from "./InstallPrompt";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getCurrentUser();
  // No silent technician fallback — if auth fails here, send to login so
  // bugs surface as redirects rather than as a silently-downgraded nav.
  if (!me) redirect("/login");
  const items = navForRole(me.role);

  return (
    <div className="md:flex md:h-screen bg-zinc-950 text-white md:overflow-hidden">
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

      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 flex-col bg-zinc-900 border-r border-zinc-800 shrink-0">
        {/* Brand */}
        <div className="flex flex-col gap-1 px-4 py-5 border-b border-zinc-800">
          <Logo variant="banner" size={32} priority />
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide mt-1.5">
            FirstCall OS
          </p>
        </div>

        {/* Search */}
        <SearchTrigger />

        {/* Nav — filtered to the user's role */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Role indicator + sign out */}
        <div className="px-4 pb-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider truncate">
            {me.name} · {me.role}
          </p>
        </div>
        <div className="px-2 py-3 border-t border-zinc-800">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm text-left"
            >
              <span className="text-base leading-none">→</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:overflow-auto">
        <InstallPrompt />
        {children}
      </main>
    </div>
  );
}
