// /dashboard forwards straight to /command-center (the canonical home) — previously
// it was in a custom dashboard state, now aligned.
import { redirect } from "next/navigation";

export default function DashboardPageRedirect() {
  redirect("/command-center");
}
