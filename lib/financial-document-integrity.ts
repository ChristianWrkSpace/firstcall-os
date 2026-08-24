export interface FinancialLineItem {
  category?: string | null;
  line_total?: unknown;
  [key: string]: unknown;
}

export interface FinancialQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface FinancialArtifact {
  job_id?: string | null;
  [key: string]: any;
}

export async function loadArtifactForJob(
  query: any,
  artifactId: string,
  jobId: string
): Promise<FinancialQueryResult<FinancialArtifact>> {
  return await query
    .eq("id", artifactId)
    .eq("job_id", jobId)
    .maybeSingle();
}

export function requireArtifactForJob<T extends { job_id?: string | null }>(
  artifact: T | null | undefined,
  jobId: string,
  onNotFound: () => never
): T {
  if (!artifact || artifact.job_id !== jobId) onNotFound();
  return artifact;
}

export function requireFinancialQueryData<T>(
  result: FinancialQueryResult<T>,
  label: string
): T {
  if (result.error || result.data === null) {
    throw new Error(`Unable to load ${label}`);
  }
  return result.data;
}

function finiteFinancialAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid financial amount");
  }
  return amount;
}

export function sumFiniteFinancialAmounts(values: readonly unknown[]): number {
  let total = 0;
  for (const value of values) {
    const nextTotal = total + finiteFinancialAmount(value);
    if (!Number.isFinite(nextTotal)) {
      throw new Error("Invalid financial total");
    }
    total = nextTotal;
  }
  return total;
}

export function summarizePrintLineItems<T extends FinancialLineItem>(
  items: readonly T[],
  categoryOrder: readonly string[]
): {
  byCategory: Record<string, T[]>;
  categories: string[];
  subtotalsByCategory: Record<string, number>;
  grandTotal: number;
} {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const category = item.category?.trim() || "Other";
    const categoryItems = grouped.get(category) ?? [];
    categoryItems.push(item);
    grouped.set(category, categoryItems);
  }

  const otherCategory = "Other";
  const preferredCategories = categoryOrder.filter(
    (category) => category !== otherCategory && (grouped.get(category)?.length ?? 0) > 0
  );
  const customCategories = [...grouped.keys()]
    .filter(
      (category) =>
        category !== otherCategory && !categoryOrder.includes(category)
    )
    .sort((a, b) => a.localeCompare(b));
  const categories = [
    ...preferredCategories,
    ...customCategories,
    ...(grouped.get(otherCategory)?.length ? [otherCategory] : []),
  ];

  const byCategory = Object.fromEntries(grouped) as Record<string, T[]>;
  const subtotalsByCategory = Object.fromEntries(
    categories.map((category) => [
      category,
      sumFiniteFinancialAmounts(
        byCategory[category].map((item) => item.line_total)
      ),
    ])
  ) as Record<string, number>;
  const grandTotal = sumFiniteFinancialAmounts(
    categories.map((category) => subtotalsByCategory[category])
  );

  return { byCategory, categories, subtotalsByCategory, grandTotal };
}
