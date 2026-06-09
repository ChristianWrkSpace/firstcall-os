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
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Unit Price Book</h1>
        <p className="text-ink-2 text-sm mt-1 max-w-2xl">
          The reviewed ground-truth unit prices Ledger uses when drafting
          estimates. Lines whose Xactimate code is in this book get tagged{" "}
          <span className="text-pine font-semibold">book</span> and the
          AI cannot deviate from the price. Codes not in the book get tagged{" "}
          <span className="text-honey font-semibold">guess</span> — those
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

      <section className="glass-card p-5 mb-5 bg-blue-500/5 border border-info/20">
        <h2 className="text-info font-semibold mb-2">How to seed this book</h2>
        <ol className="text-ink-2 text-sm space-y-1.5 list-decimal pl-5">
          <li>
            Export a CSV from your most recent Xactimate (or manually build one)
            with columns:{" "}
            <code className="text-info bg-info/10 px-1 rounded">
              code,description,unit,unit_price,notes
            </code>
          </li>
          <li>
            Save it locally at e.g.{" "}
            <code className="text-info bg-info/10 px-1 rounded">
              ./price-book-seed.csv
            </code>
          </li>
          <li>
            Run{" "}
            <code className="text-info bg-info/10 px-1 rounded">
              npx tsx scripts/seed-price-book.ts ./price-book-seed.csv
            </code>{" "}
            from the project root.
          </li>
          <li>
            Each row upserts into the book with{" "}
            <span className="text-ink font-semibold">source = seeded</span>
            . Re-running the script overwrites existing rows so you can keep
            the CSV as the source of truth and re-seed on price changes.
          </li>
        </ol>
      </section>

      {rows.length === 0 ? (
        <section className="glass-card p-8 text-center">
          <p className="text-ink-2">
            No prices in the book yet. Until you seed one, every estimate line
            will be tagged{" "}
            <span className="text-honey font-semibold">guess</span> and
            you should review every unit price by hand before approving.
          </p>
        </section>
      ) : (
        <section className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tint text-ink-3 text-xs uppercase tracking-wide">
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
                  className="border-b border-edge2 hover:bg-shade/20"
                >
                  <td className="px-4 py-2.5 font-mono text-ink text-xs">
                    {r.xactimate_code}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{r.description}</td>
                  <td className="px-4 py-2.5 text-ink-2 text-xs uppercase">
                    {r.unit}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink font-mono">
                    ${Number(r.unit_price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5">
                    <SourceBadge source={r.source} sampleSize={r.sample_size} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-3 text-xs">
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
      <p className="text-ink-3 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-ink text-2xl font-bold font-mono mt-1">{value}</p>
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
      cls: "bg-info/10 text-info border-info/20",
      label: "manual",
    },
    seeded: {
      cls: "bg-violet-500/10 text-violet-700 border-purple-500/20",
      label: "seeded",
    },
    learned: {
      cls: "bg-pine/10 text-pine border-green-500/20",
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
