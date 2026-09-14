import RoleConfig from "@/models/RoleConfig";
import { connectDB } from "@/lib/db";
import { ROLES, ROLE_PERMISSIONS, ROLE_ROUTES } from "@/lib/roles";
import { ALL_PERMISSIONS, ALL_ROUTES, ALWAYS_ALLOWED_ROUTES, LOCKED_ROLE } from "@/lib/permission-catalog";
import type { Permission, Role } from "@/types/domain";

export type EffectiveRoleConfig = {
  role: Role;
  permissions: Permission[];
  routes: string[];
  /** True when an administrator has saved an override for this role. */
  customised: boolean;
  updatedByName?: string;
  updatedAt?: Date;
};

/**
 * Role configuration is read on every authenticated request, so it is cached in
 * process for a short window rather than fetched each time. The window is what
 * bounds how long another server instance keeps serving a stale table after an
 * edit; `invalidateRoleConfigCache` makes the saving instance update immediately.
 */
const CACHE_TTL_MS = 30_000;
const globalForRoleConfig = globalThis as typeof globalThis & {
  roleConfigCache?: { at: number; value: Map<Role, EffectiveRoleConfig> };
};

export function invalidateRoleConfigCache() {
  globalForRoleConfig.roleConfigCache = undefined;
}

function defaultsFor(role: Role): EffectiveRoleConfig {
  return {
    role,
    permissions: [...(ROLE_PERMISSIONS[role] || [])],
    routes: [...(ROLE_ROUTES[role] || [])].filter((route) => !ALWAYS_ALLOWED_ROUTES.includes(route)),
    customised: false
  };
}

/**
 * Master Admin is the recovery role. Its access is always the full set regardless
 * of what is stored, so a mis-save can never leave the portal with nobody able to
 * put it right.
 */
function lockedConfig(): EffectiveRoleConfig {
  return { role: LOCKED_ROLE, permissions: [...ALL_PERMISSIONS], routes: [...ALL_ROUTES], customised: false };
}

export async function getRoleConfigs(): Promise<Map<Role, EffectiveRoleConfig>> {
  const cached = globalForRoleConfig.roleConfigCache;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  await connectDB();
  const stored = await RoleConfig.find().lean();
  const byRole = new Map(stored.map((doc) => [String(doc._id), doc]));
  const value = new Map<Role, EffectiveRoleConfig>();

  for (const role of ROLES) {
    if (role === LOCKED_ROLE) { value.set(role, lockedConfig()); continue; }
    const doc = byRole.get(role);
    if (!doc) { value.set(role, defaultsFor(role)); continue; }
    value.set(role, {
      role,
      // Unknown entries are dropped rather than trusted: a permission removed from
      // the code must not keep granting access because a stored row still names it.
      permissions: (doc.permissions || []).filter((p): p is Permission => ALL_PERMISSIONS.includes(p as Permission)),
      routes: (doc.routes || []).filter((r) => ALL_ROUTES.includes(r)),
      customised: true,
      updatedByName: doc.updatedByName || undefined,
      updatedAt: doc.updatedAt
    });
  }

  globalForRoleConfig.roleConfigCache = { at: Date.now(), value };
  return value;
}

export async function effectivePermissions(role: Role): Promise<Permission[]> {
  return (await getRoleConfigs()).get(role)?.permissions ?? defaultsFor(role).permissions;
}

export async function effectiveRoutes(role: Role): Promise<string[]> {
  const configured = (await getRoleConfigs()).get(role)?.routes ?? defaultsFor(role).routes;
  return [...ALWAYS_ALLOWED_ROUTES, ...configured];
}

export async function saveRoleConfig(
  role: Role,
  input: { permissions: Permission[]; routes: string[] },
  actor: { id: string; name: string }
) {
  if (role === LOCKED_ROLE) {
    throw Object.assign(new Error("Master Admin access is fixed and cannot be changed."), { status: 400 });
  }
  if (!ROLES.includes(role)) throw Object.assign(new Error("Unknown role"), { status: 400 });

  const permissions = [...new Set(input.permissions)].filter((p) => ALL_PERMISSIONS.includes(p));
  const routes = [...new Set(input.routes)].filter((r) => ALL_ROUTES.includes(r));

  await connectDB();
  await RoleConfig.updateOne(
    { _id: role },
    { $set: { permissions, routes, updatedBy: actor.id, updatedByName: actor.name } },
    { upsert: true }
  );
  invalidateRoleConfigCache();
  return (await getRoleConfigs()).get(role)!;
}

export async function resetRoleConfig(role: Role) {
  if (role === LOCKED_ROLE) {
    throw Object.assign(new Error("Master Admin access is fixed and cannot be changed."), { status: 400 });
  }
  await connectDB();
  await RoleConfig.deleteOne({ _id: role });
  invalidateRoleConfigCache();
  return (await getRoleConfigs()).get(role)!;
}
