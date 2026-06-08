     1|import { redirect } from "next/navigation";
     2|import { signOut } from "@/app/actions/auth";
     3|import { navSectionsForRole, navForRole } from "@/lib/nav";
     4|import { getCurrentUser } from "@/lib/auth-helpers";
     5|import Logo from "@/components/Logo";
     6|import MobileNav from "./MobileNav";
     7|import CommandPalette from "./CommandPalette";
     8|import SearchTrigger from "./SearchTrigger";
     9|import NotificationBell from "./NotificationBell";
    10|import InstallPrompt from "./InstallPrompt";
    11|import SidebarNav from "./SidebarNav";
    12|
    13|// Feature flag: set NEXT_PUBLIC_AMBIENT_SHELL=true to use the new spatial UI.
    14|const USE_AMBIENT_SHELL = process.env.NEXT_PUBLIC_AMBIENT_SHELL === "true";
    15|
    16|// Dynamic import — only loaded when the flag is on (tree-shaken otherwise)
    17|import { AmbientShell } from "@/components/layout/ambient-shell";
    18|import { SpatialSidebar } from "@/components/layout/spatial-sidebar";
    19|
    20|export default async function DashboardLayout({
    21|  children,
    22|}: {
    23|  children: React.ReactNode;
    24|}) {
    25|  const me = await getCurrentUser();
    26|  if (!me) redirect("/login");
    27|  const sections = navSectionsForRole(me.role);
    28|  const items = navForRole(me.role);
    29|
    30|  // ── NEW: Ambient Intelligence OS Shell ──────────────────────
    31|  if (USE_AMBIENT_SHELL) {
    32|    return (
    33|      <>
    34|        <CommandPalette />
    35|        <MobileNav items={items} />
    36|        <AmbientShell
    37|          sidebar={
    38|            <SpatialSidebar
    39|              sections={sections}
    40|              activePath=""
    41|              logo={
    42|                <div className="flex flex-col gap-1">
    43|                  <Logo variant="banner" size={32} priority />
    44|                  <p className="text-[color:var(--color-text-muted)] text-[10px] uppercase tracking-[0.18em] mt-1.5">
    45|                    FirstCall OS
    46|                  </p>
    47|                </div>
    48|              }
    49|              footer={
    50|                <div className="space-y-3">
    51|                  <div className="flex items-center justify-between">
    52|                    <p className="text-[color:var(--color-text-muted)] text-[10px] uppercase tracking-[0.18em] truncate">
    53|                      {me.name} · {me.role}
    54|                    </p>
    55|                    <div className="w-1.5 h-1.5 rounded-full bg-[#5FBDB0]" />
    56|                  </div>
    57|                  <form action={signOut}>
    58|                    <button
    59|                      type="submit"
    60|                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)] transition-colors text-sm text-left"
    61|                    >
    62|                      <span className="text-base leading-none">→</span>
    63|                      Sign out
    64|                    </button>
    65|                  </form>
    66|                </div>
    67|              }
    68|            />
    69|          }
    70|          topBar={
    71|            <div className="flex items-center justify-between w-full">
    72|              <SearchTrigger />
    73|              <div className="flex items-center gap-4">
    74|                <NotificationBell />
    75|                <Logo variant="mark" size={20} />
    76|              </div>
    77|            </div>
    78|          }
    79|        >
    80|          <InstallPrompt />
    81|          {children}
    82|        </AmbientShell>
    83|      </>
    84|    );
    85|  }
    86|
    87|  // ── OLD: Legacy Dashboard Layout ────────────────────────────
    88|  return (
    89|    <div className="md:flex md:h-screen app-backdrop md:overflow-hidden">
    90|      <CommandPalette />
    91|      <MobileNav items={items} />
    92|      <div className="hidden md:block fixed top-4 right-5 z-30 pointer-events-none opacity-90">
    93|        <Logo variant="mark" size={32} />
    94|      </div>
    95|      <NotificationBell />
    96|      <aside className="hidden md:flex w-56 flex-col shrink-0 bg-white/[0.02] backdrop-blur-2xl border-r border-white/[0.06]">
    97|        <div className="flex flex-col gap-1 px-4 py-5 border-b border-white/[0.06]">
    98|          <Logo variant="banner" size={32} priority />
    99|          <p className="text-white/40 text-[10px] uppercase tracking-[0.18em] mt-1.5">
   100|            FirstCall OS
   101|          </p>
   102|        </div>
   103|        <SearchTrigger />
   104|        <SidebarNav sections={sections} />
   105|        <div className="px-4 pb-3">
   106|          <p className="text-white/35 text-[10px] uppercase tracking-[0.18em] truncate">
   107|            {me.name} · {me.role}
   108|          </p>
   109|        </div>
   110|        <div className="px-2 py-3 border-t border-white/[0.06]">
   111|          <form action={signOut}>
   112|            <button
   113|              type="submit"
   114|              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors text-sm text-left"
   115|            >
   116|              <span className="text-base leading-none">→</span>
   117|              Sign out
   118|            </button>
   119|          </form>
   120|        </div>
   121|      </aside>
   122|      <main className="flex-1 md:overflow-auto relative">
   123|        <InstallPrompt />
   124|        {children}
   125|      </main>
   126|    </div>
   127|  );
   128|}
   129|