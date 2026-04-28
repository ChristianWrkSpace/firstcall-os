export const EQUIPMENT_TYPES = [
  { value: "lgr_dehumidifier",          label: "LGR Dehumidifier" },
  { value: "conventional_dehumidifier", label: "Conventional Dehumidifier" },
  { value: "air_mover",                 label: "Air Mover" },
  { value: "air_scrubber",              label: "Air Scrubber (HEPA)" },
  { value: "extractor",                 label: "Extractor" },
  { value: "other",                     label: "Other" },
] as const;

export const EQUIPMENT_STATUSES = [
  "available",
  "deployed",
  "maintenance",
  "retired",
] as const;

export const EQUIPMENT_STATUS_COLORS: Record<string, string> = {
  available:   "bg-green-500/15 text-green-400",
  deployed:    "bg-blue-500/15 text-blue-400",
  maintenance: "bg-yellow-500/15 text-yellow-400",
  retired:     "bg-zinc-700 text-zinc-400",
};

export function equipmentTypeLabel(value: string): string {
  return EQUIPMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}
