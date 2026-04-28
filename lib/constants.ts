export const STATUS_COLORS: Record<string, string> = {
  lead:           "bg-blue-500/20 text-blue-400",
  inspection:     "bg-yellow-500/20 text-yellow-400",
  mitigation:     "bg-orange-500/20 text-orange-400",
  drying:         "bg-purple-500/20 text-purple-400",
  reconstruction: "bg-indigo-500/20 text-indigo-400",
  completed:      "bg-green-500/20 text-green-400",
  cancelled:      "bg-zinc-500/20 text-zinc-400",
};

export const JOB_STATUSES = [
  "lead",
  "inspection",
  "mitigation",
  "drying",
  "reconstruction",
  "completed",
  "cancelled",
] as const;

export const JOB_TYPES = [
  { value: "water",  label: "Water Damage" },
  { value: "fire",   label: "Fire & Smoke" },
  { value: "mold",   label: "Mold Remediation" },
  { value: "storm",  label: "Storm Damage" },
  { value: "other",  label: "Other" },
] as const;
