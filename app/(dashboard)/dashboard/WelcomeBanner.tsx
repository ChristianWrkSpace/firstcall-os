"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "firstcall-os.welcome-dismissed";

export default function WelcomeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-5 mb-5 flex items-start gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold flex items-center gap-2">
          👋 Welcome to FirstCall OS
        </p>
        <p className="text-zinc-300 text-sm mt-1.5 leading-snug max-w-2xl">
          New here? The Help page walks through every agent (Athena, Argus,
          Ledger, Esquire, Solomon…), the daily workflow, and answers common
          questions. Takes ~5 min to skim.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link
          href="/help"
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
        >
          Tour the system →
        </Link>
        <button
          onClick={dismiss}
          className="px-3 py-2 text-zinc-400 hover:text-white text-sm rounded-lg"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
