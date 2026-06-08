// Command Center — spatial glass BentoGrid (Ambient Intelligence OS)

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { loadCommandCenterData } from "@/lib/command-center-data";
import CommandCenterNew from "./page-new";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  await loadCommandCenterData({
    name: me.name?.split(" ")[0] ?? "there",
    role: me.role.charAt(0).toUpperCase() + me.role.slice(1),
  });

  return <CommandCenterNew />;
}
