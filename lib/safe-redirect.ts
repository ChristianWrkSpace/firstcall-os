export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string
): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  if (candidate.includes("\\")) return fallback;

  try {
    const decoded = decodeURIComponent(candidate);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return candidate;
}
