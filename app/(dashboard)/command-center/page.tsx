// Command Center
import { redirect } from "next/navigation";
import dynamicImport from "next/dynamic";
import { getCurrentUser } from "@/lib/auth-helpers";

const CommandCenterNew = dynamicImport(
  () => import("./page-new"),
  { ssr: false, loading: () => <CommandCenterFallback /> }
);

function CommandCenterFallback() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-xl" style={{ backgroundColor: "var(--color-surface)" }} />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="md:col-span-3 h-32 rounded-2xl" style={{ backgroundColor: "var(--color-surface)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return <CommandCenterNew />;
}
