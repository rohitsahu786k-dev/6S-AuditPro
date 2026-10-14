import type { Permission, Role } from "@/types/domain";

/**
 * The catalogue the Permissions screen renders from, and the allow-list the API
 * validates against. Pure data with no database import, because `lib/roles.ts`
 * and the proxy both reach it from the edge runtime.
 *
 * Adding a permission to `types/domain.ts` without adding it here leaves it
 * invisible to administrators, so the security suite asserts the two agree.
 */
export type PermissionGroup = {
  key: string;
  label: string;
  description: string;
  permissions: Array<{ id: Permission; label: string; description: string }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "audits",
    label: "Audits",
    description: "Running 6S audits and recording checklist responses.",
    permissions: [
      { id: "audits:read", label: "View audits", description: "Open audit history and audit detail." },
      { id: "audits:create", label: "Create audits", description: "Run a new audit and import ad-hoc assessments." },
      { id: "audits:update", label: "Edit audits", description: "Change audit dates and details after submission." },
      { id: "audits:delete", label: "Delete audits", description: "Permanently remove an audit and its findings." }
    ]
  },
  {
    key: "findings",
    label: "Findings & CAPA",
    description: "Non-conformities raised by an audit and the actions that close them.",
    permissions: [
      { id: "findings:read", label: "View findings", description: "Open the findings register and finding detail." },
      { id: "findings:create", label: "Raise findings", description: "Log a non-conformity outside an audit." },
      { id: "findings:update", label: "Edit findings", description: "Change severity, owner, department or target date." },
      { id: "findings:close", label: "Close findings", description: "Mark a finding resolved." },
      { id: "capa:submit", label: "Submit CAPA", description: "Provide the corrective action and upload the after photos." },
      { id: "capa:review", label: "Review CAPA", description: "Approve, reject or reopen a submitted CAPA." }
    ]
  },
  {
    key: "masters",
    label: "Master data",
    description: "Departments, zones, checklist questions and the personnel registry.",
    permissions: [
      { id: "masters:read", label: "View master data", description: "Read departments, zones, questions and people." },
      { id: "masters:create", label: "Add master data", description: "Create a department, zone, question or person." },
      { id: "masters:update", label: "Edit master data", description: "Change an existing master record." },
      { id: "masters:delete", label: "Delete master data", description: "Remove a master record permanently." }
    ]
  },
  {
    key: "users",
    label: "User accounts",
    description: "Who can sign in and what role they hold.",
    permissions: [
      { id: "users:read", label: "View users", description: "See the user account list." },
      { id: "users:create", label: "Create users", description: "Add a new account and assign its role." },
      { id: "users:update", label: "Edit users", description: "Change a user's name, role, department or password." },
      { id: "users:disable", label: "Deactivate users", description: "Revoke an account's access." }
    ]
  },
  {
    key: "reporting",
    label: "Analytics & reporting",
    description: "Dashboards and exported reports.",
    permissions: [
      { id: "analytics:read", label: "View analytics", description: "Open dashboards, charts and the severity heatmap." },
      { id: "reports:export", label: "Export reports", description: "Download CSV and PDF reports." }
    ]
  },
  {
    key: "email",
    label: "Email",
    description: "Notification templates and the delivery log.",
    permissions: [
      { id: "emailTemplates:read", label: "View templates", description: "Read notification email templates." },
      { id: "emailTemplates:create", label: "Create templates", description: "Add a new notification template." },
      { id: "emailTemplates:update", label: "Edit templates", description: "Change template content and send test mail." },
      { id: "emailTemplates:disable", label: "Disable templates", description: "Stop a template from being used." },
      { id: "emailLogs:read", label: "View email log", description: "See what was sent, to whom, and retry failures." }
    ]
  },
  {
    key: "system",
    label: "System",
    description: "Settings that affect the whole portal.",
    permissions: [
      { id: "settings:manage", label: "Manage settings", description: "SMTP settings and this permissions screen." }
    ]
  }
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => p.id));

/** Pages a role can be granted. The dashboard is deliberately not listed: it is the
 *  landing page every signed-in user is redirected to, so it is always available. */
export const ROUTE_CATALOG: Array<{ id: string; label: string; description: string }> = [
  { id: "/audits", label: "New Audit", description: "Run an audit or import an ad-hoc assessment." },
  { id: "/audit-history", label: "Audit History", description: "Browse completed audits and their scores." },
  { id: "/findings", label: "Findings", description: "The findings and CAPA dashboard." },
  { id: "/register", label: "Register", description: "The printable audit and finding register." },
  { id: "/media", label: "Media Manager", description: "Evidence photos across audits and findings." },
  { id: "/analytics", label: "Analytics", description: "Charts, heatmaps and report exports." },
  { id: "/admin", label: "Admin Console", description: "Users, master data, email and permissions." }
];

/** Always reachable by anyone signed in, so no role can be locked out of the app. */
export const ALWAYS_ALLOWED_ROUTES = ["/dashboard", "/ocp-manual"];

export const ALL_ROUTES: string[] = ROUTE_CATALOG.map((route) => route.id);

/** Master Admin is the recovery role: its access is fixed so the portal can never
 *  be configured into a state where nobody can undo the change. */
export const LOCKED_ROLE: Role = "MASTER_ADMIN";
