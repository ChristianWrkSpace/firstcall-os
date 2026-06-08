// Command Center — real data wired from existing tables.
// When NEXT_PUBLIC_AMBIENT_SHELL=true, renders the new spatial glass UI.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { loadCommandCenterData } from "@/lib/command-center-data";
import CommandCenterShell from "./CommandCenterShell";
import CommandCenterNew from "./page-new";

export const dynamic = "force-dynamic";

const USE_AMBIENT = process.env.NEXT_PUBLIC_AMBIENT_SHELL === "true";

export default async function CommandCenterPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const data = await loadCommandCenterData({
    name: me.name?.split(" ")[0] ?? "there",
    role: me.role.charAt(0).toUpperCase() + me.role.slice(1),
  });

  return USE_AMBIENT ? <CommandCenterNew /> : <CommandCenterShell data={data} />;
}
