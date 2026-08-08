type RequestInfo = {
  path: string;
  method: string;
  headers: Record<string, string | string[]>;
};

type RequestContext = {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "proxy";
  renderSource?: string;
  revalidateReason?: string;
  renderType?: string;
};

export function register() {
  console.info(JSON.stringify({
    level: "info",
    event: "application.started",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
  }));
}

export function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: RequestContext
) {
  const errorType = error instanceof Error ? error.name : "UnknownError";
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;

  // Log only Next's route template (for example `/portal/[token]`). Concrete
  // request paths can contain bearer credentials in dynamic URL segments.
  const route = context.routePath;
  console.error(JSON.stringify({
    level: "error",
    event: "request.failed",
    errorType,
    digest,
    method: request.method,
    route,
    routeType: context.routeType,
  }));
}
