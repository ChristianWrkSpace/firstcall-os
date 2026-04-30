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
  const res = NextResponse.next();
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
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));

  if (isProtected && !session) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
  }

  if (path === "/login" && session) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", req.url)));
  }

  if (path === "/") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL(session ? "/dashboard" : "/login", req.url))
    );
  }

  return applySecurityHeaders(res);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
