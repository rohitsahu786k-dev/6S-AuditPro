import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { ROLE_ROUTES } from "@/lib/roles";
import { getAppUrl } from "@/lib/app-url";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/favicon.png", "/onepws-dark-logo-scaled.png"];

// Derived from the incoming request so the browser stays on whichever domain the
// app is served from. A fixed origin here would send visitors of one domain to
// another, which breaks every domain except the one hardcoded.
function redirectTo(request: NextRequest, pathname: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && ![request.nextUrl.origin, getAppUrl()].includes(origin))) {
      return NextResponse.json({ ok: false, error: "Forbidden origin" }, { status: 403 });
    }
  }
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/cron/") || pathname === "/api/health" || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const user = request.auth?.user;
  if (!user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return redirectTo(request, "/login", pathname);
  }

  if (!pathname.startsWith("/api")) {
    const allowed = ROLE_ROUTES[user.role] || [];
    const isAllowed = pathname === "/" || allowed.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (!isAllowed) return redirectTo(request, "/dashboard");
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|onepws-dark-logo-scaled.png|login|signup|forgot-password|reset-password).*)"]
};
