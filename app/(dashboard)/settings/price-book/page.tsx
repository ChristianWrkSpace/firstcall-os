import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { PriceBookEntry } from "@/lib/price-book-types";

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
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Unit Price Book</h1>
        <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
          The reviewed ground-truth unit prices Ledger uses when drafting
          estimates. Lines whose Xactimate code is in this book get tagged{" "}
          <span className="text-green-400 font-semibold">book</span> and the
          AI cannot deviate from the price. Codes not in the book get tagged{" "}
          <span className="text-yellow-400 font-semibold">guess</span> — those
          unit prices are LLM-invented and need review before sending.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Total entries" value={rows.length.toString()} />
        <Stat
          label="Seeded + manual"
          value={(byCount.manual + byCount.seeded).toString()}
        />
        <Stat label="Learned from history" value={byCount.learned.toString()} />
      </div>

      <section className="glass-card p-5 mb-5 bg-blue-500/5 border border-blue-500/20">
        <h2 className="text-blue-300 font-semibold mb-2">How to seed this book</h2>
        <ol className="text-zinc-300 text-sm space-y-1.5 list-decimal pl-5">
          <li>
            Export a CSV from your most recent Xactimate (or manually build one)
            with columns:{" "}
            <code className="text-blue-300 bg-blue-500/10 px-1 rounded">
              code,description,unit,unit_price,notes
            </code>
          </li>
          <li>
            Save it locally at e.g.{" "}
            <code className="text-blue-300 bg-blue-500/10 px-1 rounded">
              ./price-book-seed.csv
            </code>
          </li>
          <li>
            Run{" "}
            <code className="text-blue-300 bg-blue-500/10 px-1 rounded">
              npx tsx scripts/seed-price-book.ts ./price-book-seed.csv
            </code>{" "}
            from the project root.
          </li>
          <li>
            Each row upserts into the book with{" "}
            <span className="text-zinc-200 font-semibold">source = seeded</span>
            . Re-running the script overwrites existing rows so you can keep
            the CSV as the source of truth and re-seed on price changes.
          </li>
        </ol>
      </section>

      {rows.length === 0 ? (
        <section className="glass-card p-8 text-center">
          <p className="text-zinc-400">
            No prices in the book yet. Until you seed one, every estimate line
            will be tagged{" "}
            <span className="text-yellow-400 font-semibold">guess</span> and
            you should review every unit price by hand before approving.
          </p>
        </section>
      ) : (
        <section className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-zinc-500 text-xs uppercase tracking-wide">
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
                  className="border-b border-white/[0.06] hover:bg-zinc-800/20"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-200 text-xs">
                    {r.xactimate_code}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-300">{r.description}</td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs uppercase">
                    {r.unit}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-200 font-mono">
                    ${Number(r.unit_price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5">
                    <SourceBadge source={r.source} sampleSize={r.sample_size} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 text-xs">
                    {new Date(r.last_updated).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold font-mono mt-1">{value}</p>
    </div>
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
      cls: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      label: "manual",
    },
    seeded: {
      cls: "bg-purple-500/15 text-purple-400 border-purple-500/20",
      label: "seeded",
    },
    learned: {
      cls: "bg-green-500/15 text-green-400 border-green-500/20",
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
