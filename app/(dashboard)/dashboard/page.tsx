// /dashboard forwards straight to /canvas (the canonical home) — previously
// it hopped through /command-center, costing an extra redirect round-trip.
import { redirect } from "next/navigation";

export default function DashboardLegacyRedirect() {
  redirect("/canvas");
}
