import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { Permission, Role, SessionUser } from "@/types/domain";
import { permissionsForRole } from "@/lib/roles";
import User from "@/models/User";
import { connectDB } from "@/lib/db";

const COOKIE_NAME = "auditpro_session";
const SESSION_DAYS = 7;

type TokenPayload = {
  sub: string;
  name: string;
  username: string;
  email?: string;
  role: Role;
  department?: string;
  zone?: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET or NEXTAUTH_SECRET is not configured");
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signSession(user: TokenPayload) {
  return jwt.sign(user, getJwtSecret(), { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySessionToken(token?: string): SessionUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as TokenPayload;
    return {
      id: payload.sub,
      name: payload.name,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      department: payload.department,
      zone: payload.zone,
      permissions: permissionsForRole(payload.role)
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
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

export async function setSessionCookie(user: { id: string; name: string; username: string; email?: string; role: Role; department?: string; zone?: string }) {
  const token = signSession({
    sub: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    department: user.department,
    zone: user.zone
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/"
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export { COOKIE_NAME };
