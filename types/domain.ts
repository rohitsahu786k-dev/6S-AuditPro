export type Role =
  | "MASTER_ADMIN"
  | "ADMIN"
  | "AUDITOR"
  | "STORES_SPOC"
  | "PRODUCTION_SPOC"
  | "MANAGEMENT";

export type Permission =
  | "users:read" | "users:create" | "users:update" | "users:disable"
  | "masters:read" | "masters:create" | "masters:update" | "masters:delete"
  | "audits:read" | "audits:create" | "audits:update" | "audits:delete"
  | "findings:read" | "findings:create" | "findings:update" | "findings:close"
  | "capa:submit" | "capa:review"
  | "analytics:read" | "reports:export"
  | "emailTemplates:read" | "emailTemplates:create" | "emailTemplates:update" | "emailTemplates:disable"
  | "emailLogs:read" | "settings:manage";

export type AuditStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type FindingStatus = "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED" | "REJECTED" | "REOPENED" | "OVERDUE";
export type Severity = "Critical" | "High" | "Medium" | "Low";
export type EmailTriggerEvent =
  | "FINDING_ASSIGNED"
  | "CAPA_SUBMITTED"
  | "CAPA_APPROVED"
  | "CAPA_REJECTED"
  | "FINDING_REOPENED"
  | "FINDING_OVERDUE"
  | "AUDIT_COMPLETED"
  | "AUDIT_REPORT_SHARED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_REQUESTED"
  | "USER_CREATED"
  | "SUMMARY";

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: Role;
  department?: string;
  zone?: string;
  permissions: Permission[];
};
