import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { NAV_ITEMS } from "@/lib/nav";
import MobileNav from "./MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="md:flex md:h-screen bg-zinc-950 text-white md:overflow-hidden">
      {/* Mobile drawer (sticky top bar + slide-out) */}
      <MobileNav />

      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-56 flex-col bg-zinc-900 border-r border-zinc-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">FC</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-none truncate">
              FirstCall OS
            </p>
            <p className="text-zinc-500 text-xs leading-none mt-0.5 truncate">
              First Call Mitigation
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
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

        {/* Sign out */}
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
      <main className="flex-1 md:overflow-auto">{children}</main>
    </div>
  );
}
