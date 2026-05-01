import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPrefixes = [
  "/dashboard",
  "/command-center",
  "/jobs",
  "/customers",
  "/calls",
  "/equipment",
  "/expenses",
  "/subs",
  "/schedule",
  "/reports",
  "/ar",
  "/partners",
  "/settings",
  "/turing",
  "/solomon",
  "/activity",
  "/approvals",
  "/progress",
  "/help",
  "/my-day",
];

// Security headers applied to every response.
//
// CSP design notes:
// - 'unsafe-inline' on styles is needed for Tailwind utility classes inlined
//   by Next.js. Removing it breaks the UI; documented tradeoff.
// - 'unsafe-eval' is allowed in dev only because Turbopack uses it; in prod
//   we keep scripts strict.
// - We allow Supabase, Stripe, Vercel, Resend, Deepgram domains where they
//   actually fetch / connect. Anthropic + AI Gateway hits server-side only.
// - frame-ancestors 'none' supersedes X-Frame-Options for modern browsers.
const IS_DEV = process.env.NODE_ENV !== "production";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Scripts: own + Vercel analytics + Stripe.js. unsafe-eval only in dev.
  `script-src 'self' 'unsafe-inline' ${IS_DEV ? "'unsafe-eval'" : ""} https://va.vercel-scripts.com https://js.stripe.com https://*.stripe.com`,
  // Styles: own + inline (Tailwind needs this) + Google Fonts if used.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Images: own + data: (base64) + Supabase storage signed URLs + photo galleries
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com",
  // Connections: Supabase (auth + REST + realtime), Photon (address autocomplete),
  // Deepgram (transcription), Stripe (checkout), Vercel (analytics)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://photon.komoot.io https://api.deepgram.com https://*.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  // Frames: Stripe Elements is iframed in
  "frame-src https://js.stripe.com https://*.stripe.com",
  // Workers (PWA service worker)
  "worker-src 'self' blob:",
  // Manifests (PWA)
  "manifest-src 'self'",
  // Block clickjacking
  "frame-ancestors 'none'",
  // Lock down forms
  "form-action 'self'",
  // Restrict where the document can navigate via meta-refresh, etc.
  "base-uri 'self'",
  // Always upgrade insecure requests
  "upgrade-insecure-requests",
].join("; ");

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  // Cross-Origin policies — protect against side-channel attacks
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // CSP — comprehensive content security policy
  res.headers.set("Content-Security-Policy", CSP_DIRECTIVES);
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
    return applySecurityHeaders(NextResponse.redirect(new URL("/command-center", req.url)));
  }

  if (path === "/") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(user ? "/command-center" : "/login", req.url))
    );
  }

  return applySecurityHeaders(res);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
