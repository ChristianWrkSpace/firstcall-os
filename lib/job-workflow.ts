import { JOB_STATUSES } from "@/lib/constants";

export { JOB_STATUSES };
export type JobStatus = (typeof JOB_STATUSES)[number];

const ACTIVE_SEQUENCE: JobStatus[] = [
  "lead",
  "inspection",
  "mitigation",
  "drying",
  "reconstruction",
  "completed",
];

export function normalizeCustomerEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function normalizeCustomerPhone(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

export function parseManualJobAmount(
  rawValue: string | null | undefined
): { value: number | null } | { error: string } {
  const normalized = rawValue?.trim().replace(/,/g, "") ?? "";
  if (!normalized) return { value: null };
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return { error: "Enter a valid billing amount." };
  }
  const decimalPart = normalized.split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return { error: "Enter no more than two decimal places." };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { error: "Enter a valid billing amount." };
  if (value < 0) return { error: "Enter a billing amount of $0 or more." };
  if (value >= 100_000_000) {
    return { error: "Billing amount must be less than $100,000,000." };
  }
  return { value };
}

export function canTransitionJobStatus(current: string, next: string): boolean {
  if (!JOB_STATUSES.includes(current as JobStatus) || !JOB_STATUSES.includes(next as JobStatus)) {
    return false;
  }
  if (current === next) return true;
  if (current === "completed" || current === "cancelled") return false;
  if (next === "cancelled") return true;

  const currentIndex = ACTIVE_SEQUENCE.indexOf(current as JobStatus);
  const nextIndex = ACTIVE_SEQUENCE.indexOf(next as JobStatus);
  return currentIndex >= 0 && nextIndex > currentIndex;
}
