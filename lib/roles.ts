import type { Permission, Role } from "@/types/domain";

export const ROLE_LABELS: Record<Role, string> = {
  MASTER_ADMIN: "Master Admin",
  ADMIN: "Admin",
  AUDITOR: "Auditor",
  SPOC: "Department SPOC",
  MANAGEMENT: "Management"
};

const allPermissions: Permission[] = [
  "users:read", "users:create", "users:update", "users:disable",
  "masters:read", "masters:create", "masters:update", "masters:delete",
  "audits:read", "audits:create", "audits:update", "audits:delete",
  "findings:read", "findings:create", "findings:update", "findings:close",
  "capa:submit", "capa:review",
  "analytics:read", "reports:export",
  "emailTemplates:read", "emailTemplates:create", "emailTemplates:update", "emailTemplates:disable",
  "emailLogs:read", "settings:manage"
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MASTER_ADMIN: allPermissions,
  ADMIN: allPermissions.filter((p) => p !== "settings:manage"),
  AUDITOR: [
    "audits:read", "audits:create", "audits:update",
    "findings:read", "findings:create", "findings:update", "findings:close",
    "capa:review", "analytics:read", "reports:export", "masters:read"
  ],
  SPOC: ["findings:read", "findings:update", "capa:submit", "analytics:read", "reports:export"],
  MANAGEMENT: ["audits:read", "findings:read", "analytics:read", "reports:export"]
};

export const ROLE_ROUTES: Record<Role, string[]> = {
  MASTER_ADMIN: ["/dashboard", "/audits", "/findings", "/register", "/analytics", "/admin", "/media"],
  ADMIN: ["/dashboard", "/audits", "/findings", "/register", "/analytics", "/admin", "/media"],
  AUDITOR: ["/dashboard", "/audits", "/findings", "/register", "/analytics", "/media"],
  SPOC: ["/dashboard", "/findings", "/analytics", "/media"],
  MANAGEMENT: ["/dashboard", "/audits", "/findings", "/register", "/analytics", "/media"]
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}
