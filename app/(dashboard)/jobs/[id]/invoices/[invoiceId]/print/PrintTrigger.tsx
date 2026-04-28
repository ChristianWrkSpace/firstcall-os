"use client";

import { useEffect } from "react";

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
