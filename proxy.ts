import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPrefixes = [
  "/dashboard",
  "/jobs",
  "/customers",
  "/calls",
  "/equipment",
  "/schedule",
  "/reports",
  "/ar",
  "/partners",
  "/settings",
];

// Security headers applied to every response
function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return res;
}

export async function proxy(req: NextRequest) {
  // Mirror the request so Supabase can write refreshed auth cookies onto BOTH
  // the request (so server components see them this turn) and the response
  // (so the browser stores them for next turn). Without this, an expired
  // session token never gets refreshed and `auth.getUser()` silently returns
  // null in the dashboard layout — degrading an owner's nav to technician.
  let res = NextResponse.next({ request: req });
  const path = req.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) actually verifies the token with Supabase
  // and triggers a refresh when needed. getSession() only reads the cookie.
  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
  }

  if (path === "/login" && user) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", req.url)));
  }

  if (path === "/") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(user ? "/dashboard" : "/login", req.url))
    );
  }

  return applySecurityHeaders(res);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
