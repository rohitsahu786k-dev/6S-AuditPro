import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { ROLE_ROUTES } from "@/lib/roles";

const PUBLIC_PATHS = ["/login", "/favicon.png", "/onepws-dark-logo-scaled.png", "/index.html"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auditpro_session")?.value;
  const user = verifySessionToken(token);
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith("/api")) {
    const allowed = ROLE_ROUTES[user.role] || [];
    const isAllowed = pathname === "/" || allowed.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (!isAllowed) return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
