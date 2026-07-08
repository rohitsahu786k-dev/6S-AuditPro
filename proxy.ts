import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { ROLE_ROUTES } from "@/lib/roles";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/favicon.png", "/onepws-dark-logo-scaled.png"];

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const user = request.auth?.user;
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
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
