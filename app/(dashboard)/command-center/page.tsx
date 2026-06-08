// Command Center — real data wired from existing tables.
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
