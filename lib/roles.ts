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
  SPOC: ["audits:read", "findings:read", "findings:update", "capa:submit", "analytics:read", "reports:export"],
  MANAGEMENT: ["audits:read", "findings:read", "capa:submit", "analytics:read", "reports:export"]
};

export const ROLE_ROUTES: Record<Role, string[]> = {
  MASTER_ADMIN: ["/dashboard", "/audits", "/audit-history", "/findings", "/register", "/analytics", "/admin", "/media"],
  ADMIN: ["/dashboard", "/audits", "/audit-history", "/findings", "/register", "/analytics", "/admin", "/media"],
  AUDITOR: ["/dashboard", "/audits", "/audit-history", "/findings", "/register", "/analytics", "/media"],
  SPOC: ["/dashboard", "/findings", "/analytics", "/media"],
  MANAGEMENT: ["/dashboard", "/audit-history", "/findings", "/register", "/analytics", "/media"]
};

/**
 * Roles whose write actions are confined to their own department.
 *
 * Only the SPOC is scoped. Management is the oversight role: it already reads
 * every department's findings, most Management accounts carry no department at
 * all, and a HOD is expected to close a finding wherever it was raised — so
 * scoping it by department made the role unusable rather than safer. The
 * department field on a Management account is informational.
 */
const DEPARTMENT_SCOPED_ROLES: Role[] = ["SPOC"];

function normalizeDepartment(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Whether this user may act on a record owned by `department`.
 *
 * Both the Findings screen and the CAPA API call this. They previously each carried
 * their own role list, and the two disagreed: the screen offered the CAPA form to
 * anyone whose department matched, including roles the API would then reject, while
 * the department HOD — who does own the closure — was shown a read-only panel with
 * no way to attach the after photos. One predicate keeps the button and the
 * endpoint in agreement.
 */
export function canActOnDepartment(
  user: { role: Role; department?: string | null },
  department?: string | null
) {
  if (!DEPARTMENT_SCOPED_ROLES.includes(user.role)) return true;
  const own = normalizeDepartment(user.department);
  return Boolean(own) && own === normalizeDepartment(department);
}

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

