"use client";

import { type ReactNode } from "react";
import { PageBackdrop } from "@/components/ui/glass-v2";

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
    <PageBackdrop className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      {sidebar && (
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[color:var(--color-edge)] bg-[color:var(--color-surface)]/50 backdrop-blur-2xl">
          {sidebar}
        </aside>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        {topBar && (
          <header className="h-14 shrink-0 flex items-center px-6 border-b border-[color:var(--color-edge)] bg-[color:var(--color-surface)]/30 backdrop-blur-xl">
            {topBar}
          </header>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay — rendered when triggered */}
    </PageBackdrop>
  );
}
