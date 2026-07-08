import type { EmailTriggerEvent } from "@/types/domain";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "6S AuditPro";
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "OnePWS Private Limited";

export const CATEGORIES = [
  "SORT",
  "SET IN ORDER",
  "SHINE",
  "STANDARDIZE",
  "SUSTAIN",
  "SAFETY",
  "ENVIRONMENT"
] as const;

export const CATEGORY_META = {
  SORT: { short: "1S", icon: "Archive" },
  "SET IN ORDER": { short: "2S", icon: "ClipboardList" },
  SHINE: { short: "3S", icon: "Sparkles" },
  STANDARDIZE: { short: "4S", icon: "Ruler" },
  SUSTAIN: { short: "5S", icon: "RefreshCcw" },
  SAFETY: { short: "6S", icon: "ShieldCheck" },
  ENVIRONMENT: { short: "7S", icon: "Leaf" }
} as const;

export const DEFAULT_DEPARTMENTS = ["Stores", "Production", "Packaging", "Assembly", "Maintenance", "Dispatch", "HR & Admin"];

export const DEFAULT_ZONES = [
  { name: "Raw Material Store", department: "Stores", location: "Plant A" },
  { name: "Production Line 1", department: "Production", location: "Plant A" },
  { name: "Packaging Area", department: "Packaging", location: "Plant A" },
  { name: "Assembly Bay", department: "Assembly", location: "Plant B" },
  { name: "Maintenance Workshop", department: "Maintenance", location: "Plant B" },
  { name: "Dispatch Dock", department: "Dispatch", location: "Plant A" }
];

export const DEFAULT_QUESTIONS = [
  { category: "SORT", text: "Only required items are available at the workplace.", subSection: "Red tag control" },
  { category: "SORT", text: "Unwanted, damaged, or obsolete material is removed from the area.", subSection: "Unwanted material" },
  { category: "SET IN ORDER", text: "Tools and materials are arranged with clear identification.", subSection: "Place for everything" },
  { category: "SET IN ORDER", text: "Aisles, access paths, and emergency exits are clearly marked and free.", subSection: "Access control" },
  { category: "SHINE", text: "Floor, machines, panels, and storage points are clean.", subSection: "Cleaning discipline" },
  { category: "SHINE", text: "Leakages, dust, spillages, and abnormal conditions are identified.", subSection: "Abnormality detection" },
  { category: "STANDARDIZE", text: "Visual standards, labels, and checklists are available and followed.", subSection: "Visual standards" },
  { category: "STANDARDIZE", text: "Responsible owners and cleaning schedules are displayed.", subSection: "Ownership" },
  { category: "SUSTAIN", text: "Previous audit actions are sustained and verified.", subSection: "Follow-up" },
  { category: "SUSTAIN", text: "Team members understand and follow 6S expectations.", subSection: "Discipline" },
  { category: "SAFETY", text: "PPE, guarding, firefighting, and electrical safety requirements are followed.", subSection: "Safety compliance" },
  { category: "SAFETY", text: "Unsafe acts and unsafe conditions are captured for CAPA.", subSection: "Unsafe act/condition" },
  { category: "ENVIRONMENT", text: "Waste, scrap, and chemicals are segregated and controlled.", subSection: "Waste management" },
  { category: "ENVIRONMENT", text: "Environmental spill or contamination risks are controlled.", subSection: "Environmental control" }
] as const;

export const EMAIL_TRIGGER_LABELS: Record<EmailTriggerEvent, string> = {
  FINDING_ASSIGNED: "Finding Assigned",
  CAPA_SUBMITTED: "CAPA Submitted",
  CAPA_APPROVED: "CAPA Approved / Finding Closed",
  CAPA_REJECTED: "CAPA Rejected",
  FINDING_REOPENED: "Finding Reopened",
  FINDING_OVERDUE: "Finding Overdue Reminder",
  AUDIT_COMPLETED: "Audit Completed",
  AUDIT_REPORT_SHARED: "Audit Report Shared",
  PASSWORD_CHANGED: "Password Changed",
  PASSWORD_RESET_REQUESTED: "Password Reset Requested",
  USER_CREATED: "User Created / Account Activated",
  SUMMARY: "Daily or Weekly Summary"
};

export const EMAIL_VARIABLES = [
  "recipientName",
  "auditNumber",
  "findingNumber",
  "departmentName",
  "zoneName",
  "severity",
  "dueDate",
  "assignedTo",
  "auditorName",
  "status",
  "capaAction",
  "closureRemarks",
  "rejectionReason",
  "appUrl",
  "companyName",
  "resetUrl",
  "logoUrl",
  "totalScore",
  "capaAction"
];
