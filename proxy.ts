import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
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

/**
 * Passes the resolved path to the server components downstream, always
 * overwriting whatever the client sent so the value cannot be spoofed.
 */
function forward(request: NextRequest, pathname: string) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
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

  // Which pages a role may open is decided in AppShell, not here. Page access is
  // administrator-managed and stored in the database, which this edge runtime
  // cannot read; deciding it here as well would mean a page granted on the
  // Permissions screen stayed blocked. API authorisation is unaffected — every
  // route checks its own permission server-side.
  return forward(request, pathname);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|onepws-dark-logo-scaled.png|login|signup|forgot-password|reset-password).*)"]
};
