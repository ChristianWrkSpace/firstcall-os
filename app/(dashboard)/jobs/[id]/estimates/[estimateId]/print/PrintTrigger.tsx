"use client";

import { useEffect } from "react";

/**
 * Wires up the toolbar Print button (id="trigger-print") to window.print().
 * The button itself is rendered server-side; only the click handler is client-side.
 */
export default function PrintTrigger() {
  useEffect(() => {
    const btn = document.getElementById("trigger-print");
    if (!btn) return;
    const handler = () => window.print();
    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, []);

  return null;
}
