"use client";

import { useEffect } from "react";

/**
 * The job page folds its sections into <details> "acts". Checklist items and
 * external links deep-link to anchors inside those acts (#estimates, #moisture…).
 * A plain anchor can't reveal content inside a closed <details>, so this tiny
 * helper opens the enclosing act before the browser scrolls to the target.
 */
export default function OpenActOnHash() {
  useEffect(() => {
    function reveal() {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const act = target.closest("details");
      if (act && !act.open) act.open = true;
      // Re-scroll after the act expands so the target lands in view.
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
