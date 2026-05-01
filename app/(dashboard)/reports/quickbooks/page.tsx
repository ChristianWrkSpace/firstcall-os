import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import QuickBooksExporter from "./QuickBooksExporter";

export default async function QuickBooksPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-white">QuickBooks Export</h1>
        <p className="text-zinc-400 text-sm mt-2">Owner / manager only.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/reports"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Reports
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">
          📤 QuickBooks Export
        </h1>
        <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
          Pull customers, invoices, and payments as QBO-ready CSVs. Pick a date
          range, download, then import in QBO using the Excel/CSV import wizard.
          Audit-logged.
        </p>
      </div>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
        <QuickBooksExporter />
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-3">How to import in QBO</h2>
        <ol className="flex flex-col gap-3 text-sm text-zinc-300 list-decimal list-inside">
          <li>
            <strong className="text-white">Customers first.</strong> QBO needs
            customer records before invoices can reference them. Open QBO →
            Customers → New customer → "Import multiple". Upload the customers
            CSV from this page.
          </li>
          <li>
            <strong className="text-white">Then invoices.</strong> QBO → Sales
            → Invoices → New invoice dropdown → "Import invoices". Map columns
            if prompted; defaults usually work.
          </li>
          <li>
            <strong className="text-white">Payments last.</strong> QBO →
            Banking → Bank Deposit → Import. Each row links to the invoice by
            number, so make sure invoices imported successfully first.
          </li>
        </ol>
        <p className="text-zinc-500 text-xs mt-4">
          Note: this is a one-way export. If you edit data in QBO afterwards,
          those edits won't sync back here. Full bidirectional sync is on the
          roadmap as a separate item (QuickBooks OAuth integration).
        </p>
      </section>
    </div>
  );
}
