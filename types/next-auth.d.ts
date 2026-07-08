import type { DefaultSession } from "next-auth";
import type { Permission, Role } from "@/types/domain";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      department?: string;
      zone?: string;
      permissions: Permission[];
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: Role;
    department?: string;
    zone?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
    department?: string;
    zone?: string;
  }
}
