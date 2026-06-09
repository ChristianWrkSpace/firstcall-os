import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { PriceBookEntry } from "@/lib/price-book-types";
import { PageShell, Glass } from "@/components/ui/Glass";

export default async function PriceBookPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    redirect("/settings");
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("unit_price_book")
    .select(
      "xactimate_code, description, unit, unit_price, source, sample_size, notes, last_updated"
    )
    .order("xactimate_code", { ascending: true });

  const rows = (data ?? []) as PriceBookEntry[];
  const byCount = {
    manual: rows.filter((r) => r.source === "manual").length,
    seeded: rows.filter((r) => r.source === "seeded").length,
    learned: rows.filter((r) => r.source === "learned").length,
  };

  return (
    <PageShell
      eyebrow="Settings"
      title="Unit Price Book"
      subtitle={
        <>
          The reviewed ground-truth unit prices Ledger uses when drafting
          estimates. Lines whose Xactimate code is in this book get tagged{" "}
          <span className="text-emerald-300 font-semibold">book</span> and the
          AI cannot deviate from the price. Codes not in the book get tagged{" "}
          <span className="text-amber-300 font-semibold">guess</span> — those
          unit prices are LLM-invented and need review before sending.
        </>
      }
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="wide"
    >
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Total entries" value={rows.length.toString()} />
        <Stat label="Seeded + manual" value={(byCount.manual + byCount.seeded).toString()} />
        <Stat label="Learned from history" value={byCount.learned.toString()} />
      </div>

      <Glass accent="blue" subtle className="p-5 mb-5">
        <h2 className="text-[#A6B8E7] font-semibold mb-2">How to seed this book</h2>
        <ol className="text-white/70 text-sm space-y-1.5 list-decimal pl-5">
          <li>
            Export a CSV from your most recent Xactimate (or manually build one)
            with columns:{" "}
            <code className="text-[#A6B8E7] bg-[#6B8AD9]/10 px-1 rounded">
              code,description,unit,unit_price,notes
            </code>
          </li>
          <li>
            Save it locally at e.g.{" "}
            <code className="text-[#A6B8E7] bg-[#6B8AD9]/10 px-1 rounded">./price-book-seed.csv</code>
          </li>
          <li>
            Run{" "}
            <code className="text-[#A6B8E7] bg-[#6B8AD9]/10 px-1 rounded">
              npx tsx scripts/seed-price-book.ts ./price-book-seed.csv
            </code>{" "}
            from the project root.
          </li>
          <li>
            Each row upserts into the book with{" "}
            <span className="text-white/80 font-semibold">source = seeded</span>
            . Re-running the script overwrites existing rows so you can keep
            the CSV as the source of truth and re-seed on price changes.
          </li>
        </ol>
      </Glass>

      {rows.length === 0 ? (
        <Glass className="p-8 text-center">
          <p className="text-white/45">
            No prices in the book yet. Until you seed one, every estimate line
            will be tagged{" "}
            <span className="text-amber-300 font-semibold">guess</span> and
            you should review every unit price by hand before approving.
          </p>
        </Glass>
      ) : (
        <Glass className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left w-16">Unit</th>
                <th className="px-4 py-2 text-right w-28">Unit Price</th>
                <th className="px-4 py-2 text-left w-24">Source</th>
                <th className="px-4 py-2 text-right w-28">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.xactimate_code}
                  className="border-b border-white/[0.06] hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-2.5 font-mono text-white/80 text-xs">
                    {r.xactimate_code}
                  </td>
                  <td className="px-4 py-2.5 text-white/70">{r.description}</td>
                  <td className="px-4 py-2.5 text-white/45 text-xs uppercase">{r.unit}</td>
                  <td className="px-4 py-2.5 text-right text-white/80 font-mono">
                    ${Number(r.unit_price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5">
                    <SourceBadge source={r.source} sampleSize={r.sample_size} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/40 text-xs">
                    {new Date(r.last_updated).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      )}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Glass className="p-4">
      <p className="text-white/40 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white/95 text-2xl font-bold font-mono mt-1">{value}</p>
    </Glass>
  );
}

function SourceBadge({
  source,
  sampleSize,
}: {
  source: PriceBookEntry["source"];
  sampleSize: number;
}) {
  const cfg: Record<PriceBookEntry["source"], { cls: string; label: string }> = {
    manual: {
      cls: "bg-[#6B8AD9]/15 text-[#A6B8E7] border-[#6B8AD9]/20",
      label: "manual",
    },
    seeded: {
      cls: "bg-purple-400/15 text-purple-300 border-purple-400/20",
      label: "seeded",
    },
    learned: {
      cls: "bg-emerald-400/15 text-emerald-300 border-emerald-400/20",
      label: `learned (${sampleSize})`,
    },
  };
  const c = cfg[source];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${c.cls}`}
    >
      {c.label}
    </span>
  );
}
