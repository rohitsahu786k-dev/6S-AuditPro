import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authenticate } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;
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
