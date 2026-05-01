interface ScopeData {
  water_category?: string;
  water_class?: string;
  affected_areas?: Array<{
    location: string;
    materials: string[];
    estimated_sqft?: number;
    severity: "minor" | "moderate" | "severe";
    notes?: string;
  }>;
  equipment_needed?: {
    lgr_dehumidifiers?: number;
    conventional_dehumidifiers?: number;
    air_movers?: number;
    air_scrubbers?: number;
    other?: string[];
  };
  safety_concerns?: string[];
  ppe_required?: string[];
  estimated_dry_days?: number;
  mitigation_steps?: string[];
  summary?: string;
  confidence?: "low" | "medium" | "high";
  additional_photos_needed?: string;
  calculations?: {
    ceiling_height_ft_used?: number;
    total_affected_sqft?: number;
    affected_volume_cuft?: number;
    air_mover_math?: string;
    dehumidifier_math?: string;
    air_scrubber_math?: string;
    safety_factor_applied?: string;
    key_assumptions?: string[];
  };
}

const SEVERITY_COLORS = {
  minor: "bg-green-500/15 text-green-400",
  moderate: "bg-yellow-500/15 text-yellow-400",
  severe: "bg-red-500/15 text-red-400",
};

const CONFIDENCE_COLORS = {
  low: "bg-red-500/15 text-red-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  high: "bg-green-500/15 text-green-400",
};

function asArray<T = string>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string" && value.trim()) return [value as T];
  return [];
}

// Argus sometimes returns mitigation steps as "1. Verify…" already-numbered.
// We render them in <ol>, so strip a leading "N. " to avoid "1. 1. Verify…".
function stripLeadingNumber(s: string): string {
  return s.replace(/^\s*\d+\.\s*/, "");
}

function firstSentence(s: string): string {
  const m = s.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : s).trim();
}

export default function ScopeAssessment({
  scope,
  analyzedAt,
}: {
  scope: ScopeData;
  analyzedAt?: string;
}) {
  const affectedAreas = asArray<{
    location: string;
    materials: unknown;
    estimated_sqft?: number;
    severity: "minor" | "moderate" | "severe";
    notes?: string;
  }>(scope.affected_areas);
  const safetyConcerns = asArray<string>(scope.safety_concerns);
  const ppeRequired = asArray<string>(scope.ppe_required);
  const mitigationSteps = asArray<string>(scope.mitigation_steps).map(stripLeadingNumber);
  const equipmentOther = asArray<string>(scope.equipment_needed?.other);
  const totalSqft = affectedAreas.reduce((sum, a) => sum + (a.estimated_sqft ?? 0), 0);
  const eq = scope.equipment_needed ?? {};
  const equipmentTotal =
    (eq.lgr_dehumidifiers ?? 0) +
    (eq.conventional_dehumidifiers ?? 0) +
    (eq.air_movers ?? 0) +
    (eq.air_scrubbers ?? 0) +
    equipmentOther.length;
  const tldr = scope.summary ? firstSentence(scope.summary) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Headline: badges + 1-line tldr */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {scope.water_category && scope.water_category !== "n/a" && (
            <Badge color="bg-blue-500/15 text-blue-300">Cat {scope.water_category}</Badge>
          )}
          {scope.water_class && scope.water_class !== "n/a" && (
            <Badge color="bg-purple-500/15 text-purple-300">Class {scope.water_class}</Badge>
          )}
          {totalSqft > 0 && (
            <Badge color="bg-zinc-800 text-zinc-300">~{totalSqft} sqft</Badge>
          )}
          {scope.estimated_dry_days && (
            <Badge color="bg-zinc-800 text-zinc-300">{scope.estimated_dry_days}-day dry</Badge>
          )}
          {scope.confidence && (
            <Badge color={CONFIDENCE_COLORS[scope.confidence]}>
              {scope.confidence} confidence
            </Badge>
          )}
          {analyzedAt && (
            <span className="text-zinc-600 text-[10px] ml-auto">
              {new Date(analyzedAt).toLocaleString()}
            </span>
          )}
        </div>
        {tldr && (
          <p className="text-zinc-200 text-sm leading-relaxed">{tldr}</p>
        )}
      </div>

      {/* Photos suggested — nudge stays visible since it's actionable */}
      {scope.additional_photos_needed && (
        <Disclosure
          summary={
            <span className="flex items-center gap-2 text-yellow-300">
              <span>📷</span>
              <span className="font-medium text-sm">More photos suggested</span>
            </span>
          }
          accent="yellow"
        >
          <p className="text-yellow-200/90 text-sm leading-relaxed">
            {scope.additional_photos_needed}
          </p>
        </Disclosure>
      )}

      {/* Workflow order: where → what → how → steps → math → full summary */}

      {/* Affected Areas */}
      {affectedAreas.length > 0 && (
        <Disclosure
          summary={
            <SummaryRow
              icon="📍"
              title="Affected Areas"
              count={`${affectedAreas.length} ${affectedAreas.length === 1 ? "zone" : "zones"}`}
            />
          }
        >
          <div className="flex flex-col gap-2.5">
            {affectedAreas.map((area, i) => {
              const materials = asArray<string>(area.materials);
              const severityColor =
                SEVERITY_COLORS[area.severity] ?? "bg-zinc-700 text-zinc-300";
              return (
                <div key={i} className="border-l-2 border-zinc-700 pl-3 py-0.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium">{area.location}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {area.estimated_sqft && (
                        <span className="text-zinc-400 text-xs">{area.estimated_sqft} sqft</span>
                      )}
                      {area.severity && <Badge color={severityColor}>{area.severity}</Badge>}
                    </div>
                  </div>
                  {materials.length > 0 && (
                    <p className="text-zinc-400 text-xs mt-0.5">{materials.join(" · ")}</p>
                  )}
                  {area.notes && (
                    <p className="text-zinc-500 text-xs italic mt-1 leading-relaxed">
                      {area.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Disclosure>
      )}

      {/* Equipment to Load */}
      {equipmentTotal > 0 && (
        <Disclosure
          summary={
            <SummaryRow
              icon="🛠"
              title="Equipment to load"
              count={`${equipmentTotal} ${equipmentTotal === 1 ? "item" : "items"}`}
            />
          }
        >
          <ul className="text-sm space-y-1.5">
            {eq.lgr_dehumidifiers ? (
              <EqRow label="LGR Dehumidifiers" qty={eq.lgr_dehumidifiers} />
            ) : null}
            {eq.conventional_dehumidifiers ? (
              <EqRow label="Conventional Dehus" qty={eq.conventional_dehumidifiers} />
            ) : null}
            {eq.air_movers ? <EqRow label="Air Movers" qty={eq.air_movers} /> : null}
            {eq.air_scrubbers ? <EqRow label="Air Scrubbers" qty={eq.air_scrubbers} /> : null}
            {equipmentOther.map((o, i) => (
              <li key={i} className="text-zinc-300">• {o}</li>
            ))}
          </ul>
        </Disclosure>
      )}

      {/* Safety & PPE */}
      {(safetyConcerns.length > 0 || ppeRequired.length > 0) && (
        <Disclosure
          summary={
            <SummaryRow
              icon="⚠️"
              title="Safety & PPE"
              count={
                [
                  safetyConcerns.length && `${safetyConcerns.length} concern${safetyConcerns.length === 1 ? "" : "s"}`,
                  ppeRequired.length && `${ppeRequired.length} PPE`,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            />
          }
        >
          {safetyConcerns.length > 0 && (
            <div className="mb-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1.5">Concerns</p>
              <ul className="text-sm text-zinc-300 space-y-1 leading-relaxed">
                {safetyConcerns.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {ppeRequired.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1.5">Required PPE</p>
              <div className="flex flex-wrap gap-1.5">
                {ppeRequired.map((p, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-zinc-800 text-zinc-200 text-xs rounded"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Disclosure>
      )}

      {/* Mitigation Plan */}
      {mitigationSteps.length > 0 && (
        <Disclosure
          summary={
            <SummaryRow
              icon="📋"
              title="Mitigation plan"
              count={`${mitigationSteps.length} steps`}
            />
          }
        >
          <ol className="text-sm text-zinc-300 space-y-1.5 list-decimal pl-5 leading-relaxed">
            {mitigationSteps.map((step, i) => (
              <li key={i} className="pl-1">{step}</li>
            ))}
          </ol>
        </Disclosure>
      )}

      {/* Show the Math */}
      {scope.calculations && (
        <Disclosure
          summary={
            <SummaryRow icon="🧮" title="Show the math" count="audit trail" />
          }
          accent="blue"
        >
          <div className="flex flex-col gap-3 text-sm">
            {scope.calculations.air_mover_math && (
              <CalcRow label="Air Movers" formula={scope.calculations.air_mover_math} />
            )}
            {scope.calculations.dehumidifier_math && (
              <CalcRow label="Dehumidifiers" formula={scope.calculations.dehumidifier_math} />
            )}
            {scope.calculations.air_scrubber_math && (
              <CalcRow label="Air Scrubbers" formula={scope.calculations.air_scrubber_math} />
            )}
            {scope.calculations.safety_factor_applied && (
              <CalcRow label="Safety Buffer" formula={scope.calculations.safety_factor_applied} />
            )}
            {asArray<string>(scope.calculations.key_assumptions).length > 0 && (
              <div className="border-t border-blue-500/20 pt-3 mt-1">
                <p className="text-yellow-400 text-xs uppercase tracking-wide mb-1.5">
                  ⚠ Verify on arrival
                </p>
                <ul className="text-zinc-300 text-xs space-y-1 leading-relaxed">
                  {asArray<string>(scope.calculations.key_assumptions).map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Disclosure>
      )}

      {/* Full summary — last because the tldr is up top */}
      {scope.summary && scope.summary !== tldr && (
        <Disclosure
          summary={<SummaryRow icon="📝" title="Full summary" />}
        >
          <p className="text-zinc-300 text-sm leading-relaxed">{scope.summary}</p>
        </Disclosure>
      )}
    </div>
  );
}

function SummaryRow({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: string;
}) {
  return (
    <span className="flex items-center gap-2 flex-1 min-w-0">
      <span className="text-base">{icon}</span>
      <span className="text-white text-sm font-medium">{title}</span>
      {count && (
        <span className="text-zinc-500 text-xs ml-auto">{count}</span>
      )}
    </span>
  );
}

function Disclosure({
  summary,
  children,
  accent = "zinc",
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  accent?: "zinc" | "blue" | "yellow";
}) {
  const accentClasses =
    accent === "blue"
      ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40"
      : accent === "yellow"
        ? "bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40"
        : "bg-zinc-800/40 border-zinc-700/50 hover:border-zinc-600";
  return (
    <details className={`group border rounded-lg transition-colors ${accentClasses}`}>
      <summary className="cursor-pointer list-none flex items-center gap-2 px-3.5 py-2.5 select-none">
        <span className="flex-1 min-w-0">{summary}</span>
        <span className="text-zinc-500 text-xs transition-transform group-open:rotate-90 shrink-0">
          ▸
        </span>
      </summary>
      <div className="px-3.5 pb-3.5 pt-1">{children}</div>
    </details>
  );
}

function EqRow({ label, qty }: { label: string; qty: number }) {
  return (
    <li className="flex justify-between">
      <span className="text-zinc-300">{label}</span>
      <span className="text-white font-mono font-semibold">× {qty}</span>
    </li>
  );
}

function CalcRow({ label, formula }: { label: string; formula: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-zinc-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-zinc-100 text-sm font-mono leading-relaxed whitespace-pre-wrap">
        {formula}
      </span>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}
    >
      {children}
    </span>
  );
}
