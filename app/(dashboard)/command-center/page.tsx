// Command Center — real data wired from existing tables. Falls back to
// safe empty values if any sub-query fails (the shell renders fine with
// zeros). No backend code modified — this page is a pure read-only view.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { loadCommandCenterData } from "@/lib/command-center-data";
import CommandCenterShell from "./CommandCenterShell";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const data = await loadCommandCenterData({
    name: me.name?.split(" ")[0] ?? "there",
    role: me.role.charAt(0).toUpperCase() + me.role.slice(1),
  });

  return <CommandCenterShell data={data} />;
}
