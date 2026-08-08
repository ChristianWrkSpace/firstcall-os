// Legacy dashboard URL forwards to the practical operations home.
import { redirect } from "next/navigation";

export default function DashboardPageRedirect() {
  redirect("/command-center");
}
