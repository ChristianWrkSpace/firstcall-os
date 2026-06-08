"use client";

import { type ReactNode } from "react";

export function AmbientShell({
  children,
  sidebar,
  topBar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  topBar?: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-bg-base)" }}>
      {/* Ambient background — client-only renders fine */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 12%, rgba(107,138,217,0.10) 0%, transparent 38%), radial-gradient(circle at 82% 88%, rgba(95,189,176,0.08) 0%, transparent 42%)",
          }}
        />
      </div>

      {/* Sidebar */}
      {sidebar && (
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[color:var(--color-edge)] relative z-10"
          style={{ backgroundColor: "rgba(255,255,255,0.02)", backdropFilter: "blur(24px)" }}>
          {sidebar}
        </aside>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {topBar && (
          <header className="h-14 shrink-0 flex items-center px-6 border-b border-[color:var(--color-edge)]"
            style={{ backgroundColor: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)" }}>
            {topBar}
          </header>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
