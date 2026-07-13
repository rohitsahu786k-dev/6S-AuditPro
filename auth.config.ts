import type { NextAuthConfig } from "next-auth";
import { getAppUrl } from "@/lib/app-url";
import { permissionsForRole } from "@/lib/roles";
import type { Role } from "@/types/domain";

// Auth.js otherwise derives absolute redirects from the incoming proxy host,
// which can be an internal bind address in production.
process.env.AUTH_URL ||= getAppUrl();

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.username = user.username;
        token.role = user.role;
        token.department = user.department;
        token.zone = user.zone;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.role = token.role;
      session.user.department = token.department;
      session.user.zone = token.zone;
      session.user.permissions = permissionsForRole(token.role as Role);
      return session;
    }
  }
};
