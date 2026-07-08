import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authenticate } from "@/lib/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;
        const user = await authenticate(username, password);
        if (!user) return null;
        return {
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          email: user.email || undefined,
          role: user.role,
          department: user.department || undefined,
          zone: user.zone || undefined
        };
      }
    })
  ]
});
