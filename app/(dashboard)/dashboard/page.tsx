// /dashboard is now a permanent redirect to /command-center.
// The old "classic" dashboard is preserved as _legacy_page.tsx.bak in
// this directory if anyone needs to look at the original implementation.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardLegacyRedirect() {
  redirect("/command-center");
}
