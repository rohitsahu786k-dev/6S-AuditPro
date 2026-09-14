import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import type { Permission, SessionUser } from "@/types/domain";
import User from "@/models/User";
import { connectDB } from "@/lib/db";
import { cache } from "react";
import { effectivePermissions, effectiveRoutes } from "@/services/role-config.service";
import type { Role } from "@/types/domain";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.signedInAt) return null;
  await connectDB();
  const current = await User.findOne({ _id: session.user.id, status: "active" })
    .select("name username email role department zone passwordChangedAt").lean();
  if (!current || (current.passwordChangedAt && current.passwordChangedAt.getTime() > session.user.signedInAt)) return null;
  return {
    id: String(current._id),
    name: current.name || current.username,
    username: current.username,
    email: current.email || undefined,
    role: current.role as Role,
    department: current.department || undefined,
    zone: current.zone || undefined,
    // Read from the administrator-managed role table, which falls back to the
    // defaults in lib/roles.ts when nothing has been customised.
    permissions: await effectivePermissions(current.role as Role)
  };
});

export async function requireUser(required?: Permission | Permission[]) {
  const user = await getSessionUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (user.role === "SPOC" && !user.department?.trim()) {
    throw Object.assign(new Error("A department must be assigned to this account"), { status: 403 });
  }
  if (user.role === "MASTER_ADMIN") return user;
  const requirements = Array.isArray(required) ? required : required ? [required] : [];
  if (requirements.length && !requirements.every((p) => user.permissions.includes(p))) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

/**
 * Pages a signed-in user may open. The proxy only proves who you are; this is the
 * authorisation check, and it runs in the Node runtime where the role table is
 * readable. Keeping it in one place is why the edge proxy no longer decides.
 */
export async function allowedRoutesFor(user: SessionUser) {
  return effectiveRoutes(user.role);
}

export function isRouteAllowed(pathname: string, allowed: string[]) {
  return pathname === "/" || allowed.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function authenticate(username: string, password: string) {
  await consumeRateLimit("login-global", "all", 300, 60_000);
  await consumeRateLimit("login", username.trim().toLowerCase(), 10, 15 * 60_000);
  await connectDB();
  const user = await User.findOne({ username: username.toLowerCase(), status: "active" }).select("+passwordHash");
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
