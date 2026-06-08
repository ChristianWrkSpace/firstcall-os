// Command Center — spatial glass BentoGrid (Ambient Intelligence OS)

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import CommandCenterNew from "./page-new";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return <CommandCenterNew />;
}
