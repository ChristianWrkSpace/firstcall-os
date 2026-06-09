import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import QuickBooksExporter from "./QuickBooksExporter";
import { PageShell, Glass } from "@/components/ui/Glass";

export default async function QuickBooksPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <PageShell eyebrow="Reports" title="QuickBooks Export" width="narrow">
        <p className="text-white/45 text-sm">Owner / manager only.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Reports"
      title="📤 QuickBooks Export"
      subtitle="Pull customers, invoices, and payments as QBO-ready CSVs. Pick a date range, download, then import in QBO using the Excel/CSV import wizard. Audit-logged."
      action={
        <Link
          href="/reports"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Reports
        </Link>
      }
    >
      <Glass className="p-6 mb-5">
        <QuickBooksExporter />
      </Glass>

      <Glass className="p-6">
        <h2 className="text-white/90 font-semibold mb-3">How to import in QBO</h2>
        <ol className="flex flex-col gap-3 text-sm text-white/70 list-decimal list-inside">
          <li>
            <strong className="text-white/90">Customers first.</strong> QBO needs
            customer records before invoices can reference them. Open QBO →
            Customers → New customer → "Import multiple". Upload the customers
            CSV from this page.
          </li>
          <li>
            <strong className="text-white/90">Then invoices.</strong> QBO → Sales
            → Invoices → New invoice dropdown → "Import invoices". Map columns
            if prompted; defaults usually work.
          </li>
          <li>
            <strong className="text-white/90">Payments last.</strong> QBO →
            Banking → Bank Deposit → Import. Each row links to the invoice by
            number, so make sure invoices imported successfully first.
          </li>
        </ol>
        <p className="text-white/40 text-xs mt-4">
          Note: this is a one-way export. If you edit data in QBO afterwards,
          those edits won't sync back here. Full bidirectional sync is on the
          roadmap as a separate item (QuickBooks OAuth integration).
        </p>
      </Glass>
    </PageShell>
  );
}
