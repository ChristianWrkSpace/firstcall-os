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

// Claude occasionally returns a string for fields the schema declared as arrays.
// Coerce defensively so the UI never crashes.
function asArray<T = string>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string" && value.trim()) return [value as T];
  return [];
}

const CONFIDENCE_COLORS = {
  low: "bg-red-500/15 text-red-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  high: "bg-green-500/15 text-green-400",
};

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
  const mitigationSteps = asArray<string>(scope.mitigation_steps);
  const equipmentOther = asArray<string>(scope.equipment_needed?.other);
  const totalSqft = affectedAreas.reduce((sum, a) => sum + (a.estimated_sqft ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with confidence + meta */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {scope.water_category && scope.water_category !== "n/a" && (
            <Badge color="bg-blue-500/15 text-blue-300">Cat {scope.water_category}</Badge>
          )}
          {scope.water_class && scope.water_class !== "n/a" && (
            <Badge color="bg-purple-500/15 text-purple-300">Class {scope.water_class}</Badge>
          )}
          {totalSqft > 0 && (
            <Badge color="bg-zinc-800 text-zinc-300">~{totalSqft} sqft affected</Badge>
          )}
          {scope.estimated_dry_days && (
            <Badge color="bg-zinc-800 text-zinc-300">{scope.estimated_dry_days}-day dry</Badge>
          )}
          {scope.confidence && (
            <Badge color={CONFIDENCE_COLORS[scope.confidence]}>
              {scope.confidence} confidence
            </Badge>
          )}
        </div>
        {analyzedAt && (
          <p className="text-zinc-500 text-xs">
            Analyzed {new Date(analyzedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Summary */}
      {scope.summary && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
          <p className="text-zinc-200 text-sm leading-relaxed">{scope.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Equipment */}
        {scope.equipment_needed && (
          <Section title="🛠 Equipment Needed">
            <ul className="text-sm space-y-1.5">
              {scope.equipment_needed.lgr_dehumidifiers ? (
                <li className="flex justify-between">
                  <span className="text-zinc-300">LGR Dehumidifiers</span>
                  <span className="text-white font-mono font-semibold">
                    × {scope.equipment_needed.lgr_dehumidifiers}
                  </span>
                </li>
              ) : null}
              {scope.equipment_needed.conventional_dehumidifiers ? (
                <li className="flex justify-between">
                  <span className="text-zinc-300">Conventional Dehus</span>
                  <span className="text-white font-mono font-semibold">
                    × {scope.equipment_needed.conventional_dehumidifiers}
                  </span>
                </li>
              ) : null}
              {scope.equipment_needed.air_movers ? (
                <li className="flex justify-between">
                  <span className="text-zinc-300">Air Movers</span>
                  <span className="text-white font-mono font-semibold">
                    × {scope.equipment_needed.air_movers}
                  </span>
                </li>
              ) : null}
              {scope.equipment_needed.air_scrubbers ? (
                <li className="flex justify-between">
                  <span className="text-zinc-300">Air Scrubbers</span>
                  <span className="text-white font-mono font-semibold">
                    × {scope.equipment_needed.air_scrubbers}
                  </span>
                </li>
              ) : null}
              {equipmentOther.map((o, i) => (
                <li key={i} className="text-zinc-300">• {o}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Safety + PPE */}
        {(safetyConcerns.length > 0 || ppeRequired.length > 0) && (
          <Section title="⚠️ Safety & PPE">
            {safetyConcerns.length > 0 && (
              <div className="mb-3">
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Concerns</p>
                <ul className="text-sm text-zinc-300 space-y-1">
                  {safetyConcerns.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {ppeRequired.length > 0 && (
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Required PPE</p>
                <div className="flex flex-wrap gap-1.5">
                  {ppeRequired.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-200 text-xs rounded">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Calculations / Show the Math */}
      {scope.calculations && (
        <details className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 group" open>
          <summary className="cursor-pointer flex items-center justify-between">
            <span className="text-blue-300 text-sm font-semibold">🧮 Show the Math</span>
            <span className="text-zinc-500 text-xs group-open:hidden">click to expand</span>
          </summary>
          <div className="mt-3 flex flex-col gap-3 text-sm">
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
                <ul className="text-zinc-300 text-xs space-y-1">
                  {asArray<string>(scope.calculations.key_assumptions).map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Affected Areas */}
      {affectedAreas.length > 0 && (
        <Section title="📍 Affected Areas">
          <div className="flex flex-col gap-2">
            {affectedAreas.map((area, i) => {
              const materials = asArray<string>(area.materials);
              const severityColor =
                SEVERITY_COLORS[area.severity] ?? "bg-zinc-700 text-zinc-300";
              return (
                <div key={i} className="border-l-2 border-zinc-700 pl-3 py-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium">{area.location}</p>
                    <div className="flex items-center gap-2">
                      {area.estimated_sqft && (
                        <span className="text-zinc-400 text-xs">{area.estimated_sqft} sqft</span>
                      )}
                      {area.severity && <Badge color={severityColor}>{area.severity}</Badge>}
                    </div>
                  </div>
                  {materials.length > 0 && (
                    <p className="text-zinc-400 text-xs mt-0.5">{materials.join(" · ")}</p>
                  )}
                  {area.notes && <p className="text-zinc-500 text-xs italic mt-1">{area.notes}</p>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Mitigation Steps */}
      {mitigationSteps.length > 0 && (
        <Section title="📋 Mitigation Plan">
          <ol className="text-sm text-zinc-300 space-y-1 list-decimal list-inside">
            {mitigationSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Section>
      )}

      {/* Photos needed callout */}
      {scope.additional_photos_needed && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-yellow-400 text-xs uppercase tracking-wide mb-1">
            Argus suggests additional photos
          </p>
          <p className="text-yellow-200 text-sm">{scope.additional_photos_needed}</p>
        </div>
      )}
    </div>
  );
}

function CalcRow({ label, formula }: { label: string; formula: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-zinc-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-zinc-100 text-sm font-mono leading-relaxed">{formula}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
      <h3 className="text-white text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
      {children}
    </span>
  );
}
