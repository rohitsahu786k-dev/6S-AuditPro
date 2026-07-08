import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import type { Permission, SessionUser } from "@/types/domain";
import User from "@/models/User";
import { connectDB } from "@/lib/db";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name || session.user.username,
    username: session.user.username,
    email: session.user.email || undefined,
    role: session.user.role,
    department: session.user.department,
    zone: session.user.zone,
    permissions: session.user.permissions
  };
}

export async function requireUser(required?: Permission | Permission[]) {
  const user = await getSessionUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const requirements = Array.isArray(required) ? required : required ? [required] : [];
  if (requirements.length && !requirements.every((p) => user.permissions.includes(p))) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

export async function authenticate(username: string, password: string) {
  await connectDB();
  const user = await User.findOne({ username: username.toLowerCase(), status: "active" }).select("+passwordHash");
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
