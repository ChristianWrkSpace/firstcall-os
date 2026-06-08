     1|// Command Center — real data wired from existing tables.
     2|// When NEXT_PUBLIC_AMBIENT_SHELL=true, renders the new spatial glass UI.
     3|
     4|import { redirect } from "next/navigation";
     5|import { getCurrentUser } from "@/lib/auth-helpers";
     6|import { loadCommandCenterData } from "@/lib/command-center-data";
     7|import CommandCenterShell from "./CommandCenterShell";
     8|import CommandCenterNew from "./page-new";
     9|
    10|export const dynamic = "force-dynamic";
    11|
    12|// Defaults ON — set NEXT_PUBLIC_AMBIENT_SHELL=false to revert
const USE_AMBIENT = process.env.NEXT_PUBLIC_AMBIENT_SHELL !== "false";
    13|
    14|export default async function CommandCenterPage() {
    15|  const me = await getCurrentUser();
    16|  if (!me) redirect("/login");
    17|
    18|  const data = await loadCommandCenterData({
    19|    name: me.name?.split(" ")[0] ?? "there",
    20|    role: me.role.charAt(0).toUpperCase() + me.role.slice(1),
    21|  });
    22|
    23|  return USE_AMBIENT ? <CommandCenterNew /> : <CommandCenterShell data={data} />;
    24|}
    25|