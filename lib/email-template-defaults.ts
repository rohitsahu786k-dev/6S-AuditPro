import { emailButton, infoRow, infoTable, wrapEmailLayout } from "@/lib/email-layout";

export type DefaultEmailTemplate = {
  templateKey: string;
  templateName: string;
  triggerEvent: string;
  subject: string;
  htmlBody: string;
  textBody: string;
};

const heading = (text: string) => `<h2 style="margin:0 0 12px;font-size:19px;font-weight:800;color:#1e293b;">${text}</h2>`;
const greeting = () => `<p style="margin:0 0 12px;">Hello {{recipientName}},</p>`;
const closing = () => `<p style="margin:20px 0 0;color:#64748b;font-size:13px;">Regards,<br>{{companyName}} &mdash; 6S AuditPro</p>`;

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    templateKey: "finding-assigned",
    templateName: "Finding Assigned",
    triggerEvent: "FINDING_ASSIGNED",
    subject: "Finding {{findingNumber}} assigned to {{departmentName}}",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("New 6S Finding Assigned")}` +
        `<p style="margin:0 0 8px;">A new non-conformity has been raised during audit <strong>{{auditNumber}}</strong> and assigned to your department for corrective action.</p>` +
        `<p style="margin:12px 0;padding:12px 14px;background-color:#f8fafc;border-left:3px solid #ef2b2d;border-radius:4px;color:#334155;">{{question}}</p>` +
        infoTable(
          infoRow("Finding No.", "{{findingNumber}}") +
            infoRow("Zone", "{{zoneName}}") +
            infoRow("Department", "{{departmentName}}") +
            infoRow("Severity", "{{severity}}") +
            infoRow("Assigned To", "{{assignedTo}}") +
            infoRow("Due Date", "{{dueDate}}") +
            infoRow("Raised By", "{{auditorName}}")
        ) +
        `<p style="margin:12px 0 0;">Please submit CAPA (Corrective &amp; Preventive Action) before the due date.</p>` +
        emailButton("{{appUrl}}/findings", "Open Finding") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nA new 6S finding has been assigned to your department.\n\nFinding No: {{findingNumber}}\nZone: {{zoneName}}\nDepartment: {{departmentName}}\nSeverity: {{severity}}\nAssigned To: {{assignedTo}}\nDue Date: {{dueDate}}\nRaised By: {{auditorName}}\n\nObservation: {{question}}\n\nOpen: {{appUrl}}/findings\n\n{{companyName}}"
  },
  {
    templateKey: "capa-submitted",
    templateName: "CAPA Submitted",
    triggerEvent: "CAPA_SUBMITTED",
    subject: "CAPA submitted for {{findingNumber}}",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("CAPA Submitted for Review")}` +
        `<p style="margin:0 0 8px;">A corrective action has been submitted for finding <strong>{{findingNumber}}</strong> and is awaiting auditor review.</p>` +
        infoTable(
          infoRow("Finding No.", "{{findingNumber}}") +
            infoRow("Audit No.", "{{auditNumber}}") +
            infoRow("Zone", "{{zoneName}}") +
            infoRow("Department", "{{departmentName}}") +
            infoRow("Severity", "{{severity}}")
        ) +
        `<p style="margin:12px 0 4px;font-weight:700;font-size:13px;color:#334155;">Corrective Action</p>` +
        `<p style="margin:0 0 8px;padding:12px 14px;background-color:#f8fafc;border-left:3px solid #ef2b2d;border-radius:4px;color:#334155;">{{capaAction}}</p>` +
        emailButton("{{appUrl}}/findings", "Review CAPA") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nA CAPA has been submitted for finding {{findingNumber}} and is awaiting review.\n\nAudit No: {{auditNumber}}\nZone: {{zoneName}}\nDepartment: {{departmentName}}\nSeverity: {{severity}}\n\nCorrective Action: {{capaAction}}\n\nReview: {{appUrl}}/findings\n\n{{companyName}}"
  },
  {
    templateKey: "capa-approved",
    templateName: "CAPA Approved / Finding Closed",
    triggerEvent: "CAPA_APPROVED",
    subject: "Finding {{findingNumber}} closed",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Finding Closed")}` +
        `<p style="margin:0 0 8px;">The corrective action for finding <strong>{{findingNumber}}</strong> has been reviewed and approved. This finding is now <strong style="color:#15803d;">closed</strong>.</p>` +
        infoTable(infoRow("Finding No.", "{{findingNumber}}") + infoRow("Status", "{{status}}")) +
        `<p style="margin:12px 0 0;">${"{{closureRemarks}}"}</p>` +
        emailButton("{{appUrl}}/findings", "View Finding") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nFinding {{findingNumber}} has been reviewed and approved. Status: {{status}}.\n\nRemarks: {{closureRemarks}}\n\nView: {{appUrl}}/findings\n\n{{companyName}}"
  },
  {
    templateKey: "capa-rejected",
    templateName: "CAPA Rejected",
    triggerEvent: "CAPA_REJECTED",
    subject: "CAPA rejected for {{findingNumber}}",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("CAPA Rejected &mdash; Action Required")}` +
        `<p style="margin:0 0 8px;">The corrective action submitted for finding <strong>{{findingNumber}}</strong> was <strong style="color:#b91c1c;">rejected</strong> by the reviewing auditor. Please revise and resubmit.</p>` +
        `<p style="margin:12px 0 4px;font-weight:700;font-size:13px;color:#334155;">Rejection Reason</p>` +
        `<p style="margin:0;padding:12px 14px;background-color:#fef2f2;border-left:3px solid #b91c1c;border-radius:4px;color:#7f1d1d;">{{rejectionReason}}</p>` +
        emailButton("{{appUrl}}/findings", "Resubmit CAPA") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nThe CAPA submitted for finding {{findingNumber}} was rejected.\n\nReason: {{rejectionReason}}\n\nResubmit: {{appUrl}}/findings\n\n{{companyName}}"
  },
  {
    templateKey: "finding-reopened",
    templateName: "Finding Reopened",
    triggerEvent: "FINDING_REOPENED",
    subject: "Finding {{findingNumber}} reopened",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Finding Reopened")}` +
        `<p style="margin:0 0 8px;">Finding <strong>{{findingNumber}}</strong> has been reopened and requires a fresh corrective action submission.</p>` +
        infoTable(infoRow("Finding No.", "{{findingNumber}}") + infoRow("Status", "{{status}}")) +
        `<p style="margin:12px 0 0;">${"{{closureRemarks}}"}</p>` +
        emailButton("{{appUrl}}/findings", "Open Finding") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nFinding {{findingNumber}} has been reopened. Status: {{status}}.\n\nNote: {{closureRemarks}}\n\nOpen: {{appUrl}}/findings\n\n{{companyName}}"
  },
  {
    templateKey: "finding-overdue",
    templateName: "Manager / HOD Overdue Escalation",
    triggerEvent: "FINDING_OVERDUE",
    subject: "Escalation: Finding {{findingNumber}} is overdue",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Overdue Finding &mdash; Manager / HOD Escalation")}` +
        `<p style="margin:0 0 8px;">Finding <strong>{{findingNumber}}</strong> has passed its target due date and remains unresolved. This reminder has been escalated to the responsible Manager / HOD for immediate follow-up.</p>` +
        infoTable(
          infoRow("Finding No.", "{{findingNumber}}") +
            infoRow("Audit No.", "{{auditNumber}}") +
            infoRow("Zone", "{{zoneName}}") +
            infoRow("Department", "{{departmentName}}") +
            infoRow("Severity", "{{severity}}") +
            infoRow("Due Date", "{{dueDate}}")
        ) +
        emailButton("{{appUrl}}/findings", "Resolve Now") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nFinding {{findingNumber}} is overdue and has been escalated for Manager / HOD follow-up.\n\nAudit: {{auditNumber}}\nZone: {{zoneName}}\nDepartment: {{departmentName}}\nSeverity: {{severity}}\nDue Date: {{dueDate}}\n\nResolve: {{appUrl}}/findings\n\n{{companyName}}"
  },
  {
    templateKey: "audit-completed",
    templateName: "Audit Completed",
    triggerEvent: "AUDIT_COMPLETED",
    subject: "Audit {{auditNumber}} completed",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("6S Audit Completed")}` +
        `<p style="margin:0 0 8px;">Audit <strong>{{auditNumber}}</strong> has been completed and findings have been logged.</p>` +
        infoTable(
          infoRow("Audit No.", "{{auditNumber}}") +
            infoRow("Zone", "{{zoneName}}") +
            infoRow("Department", "{{departmentName}}") +
            infoRow("Auditor", "{{auditorName}}") +
            infoRow("Score", "{{totalScore}}") +
            infoRow("Status", "{{status}}")
        ) +
        emailButton("{{appUrl}}/audits", "View Audit Report") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nAudit {{auditNumber}} has been completed.\n\nZone: {{zoneName}}\nDepartment: {{departmentName}}\nAuditor: {{auditorName}}\nScore: {{totalScore}}\nStatus: {{status}}\n\nView: {{appUrl}}/audits\n\n{{companyName}}"
  },
  {
    templateKey: "audit-report-shared",
    templateName: "Audit Report Shared",
    triggerEvent: "AUDIT_REPORT_SHARED",
    subject: "Audit report {{auditNumber}} shared with you",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Audit Report Shared")}` +
        `<p style="margin:0 0 8px;">The audit report for <strong>{{auditNumber}}</strong> ({{departmentName}} &mdash; {{zoneName}}) has been shared with you.</p>` +
        emailButton("{{appUrl}}/audits", "View Report") +
        closing()
    ),
    textBody: "Hello {{recipientName}},\n\nThe audit report for {{auditNumber}} ({{departmentName}} - {{zoneName}}) has been shared with you.\n\nView: {{appUrl}}/audits\n\n{{companyName}}"
  },
  {
    templateKey: "password-changed",
    templateName: "Password Changed",
    triggerEvent: "PASSWORD_CHANGED",
    subject: "Your 6S AuditPro password was changed",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Password Changed")}` +
        `<p style="margin:0 0 8px;">This is a confirmation that the password for your 6S AuditPro account was just changed.</p>` +
        `<p style="margin:12px 0;padding:12px 14px;background-color:#fef2f2;border-left:3px solid #b91c1c;border-radius:4px;color:#7f1d1d;">If you did not make this change, contact your administrator immediately.</p>` +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nThe password for your 6S AuditPro account was just changed. If you did not make this change, contact your administrator immediately.\n\n{{companyName}}"
  },
  {
    templateKey: "password-reset-requested",
    templateName: "Password Reset Requested",
    triggerEvent: "PASSWORD_RESET_REQUESTED",
    subject: "Reset your 6S AuditPro password",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Reset Your Password")}` +
        `<p style="margin:0 0 8px;">We received a request to reset your 6S AuditPro password. This link expires in <strong>1 hour</strong>.</p>` +
        emailButton("{{resetUrl}}", "Reset Password") +
        `<p style="margin:16px 0 0;font-size:13px;color:#64748b;">If you did not request this, you can safely ignore this email &mdash; your password will remain unchanged.</p>` +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nWe received a request to reset your 6S AuditPro password. This link expires in 1 hour.\n\nReset: {{resetUrl}}\n\nIf you did not request this, you can safely ignore this email.\n\n{{companyName}}"
  },
  {
    templateKey: "user-created",
    templateName: "User Created / Account Activated",
    triggerEvent: "USER_CREATED",
    subject: "Your 6S AuditPro account is active",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("Welcome to 6S AuditPro")}` +
        `<p style="margin:0 0 8px;">Your account has been created and is now active. You can sign in using the credentials provided to you.</p>` +
        emailButton("{{appUrl}}/login", "Sign In") +
        closing()
    ),
    textBody: "Hello {{recipientName}},\n\nYour 6S AuditPro account has been created and is now active.\n\nSign in: {{appUrl}}/login\n\n{{companyName}}"
  },
  {
    templateKey: "summary",
    templateName: "Daily or Weekly Summary",
    triggerEvent: "SUMMARY",
    subject: "6S AuditPro summary",
    htmlBody: wrapEmailLayout(
      `${greeting()}${heading("6S AuditPro Activity Summary")}` +
        `<p style="margin:0 0 8px;">Here is your current 6S audit activity summary.</p>` +
        infoTable(
          infoRow("Open Findings", "{{openCount}}") +
            infoRow("In Progress", "{{inProgressCount}}") +
            infoRow("Closed", "{{closedCount}}") +
            infoRow("Overdue", "{{overdueCount}}") +
            infoRow("Critical Active", "{{criticalCount}}")
        ) +
        emailButton("{{appUrl}}/dashboard", "Open Dashboard") +
        closing()
    ),
    textBody:
      "Hello {{recipientName}},\n\nHere is your current 6S audit activity summary.\n\nOpen Findings: {{openCount}}\nIn Progress: {{inProgressCount}}\nClosed: {{closedCount}}\nOverdue: {{overdueCount}}\nCritical Active: {{criticalCount}}\n\nOpen dashboard: {{appUrl}}/dashboard\n\n{{companyName}}"
  }
];
