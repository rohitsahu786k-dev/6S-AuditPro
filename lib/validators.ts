import { z } from "zod";

export const roleSchema = z.enum(["MASTER_ADMIN", "ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"]);
export const emailSchema = z.string().email().optional().or(z.literal(""));

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200)
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).toLowerCase(),
  email: emailSchema,
  password: z.string().min(8).max(200),
  role: roleSchema,
  department: z.string().trim().optional(),
  zone: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial().extend({
  password: z.string().min(8).max(200).optional()
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(200)
});

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).toLowerCase(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(200)
});

export const auditSchema = z.object({
  zone: z.string().trim().min(1),
  department: z.string().trim().min(1),
  auditorName: z.string().trim().min(1),
  date: z.coerce.date().optional(),
  checklist: z.array(z.object({
    questionId: z.string(),
    category: z.string(),
    question: z.string(),
    response: z.enum(["Adequate", "Not Adequate", "N/A"]),
    observation: z.string().optional(),
    severity: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
    beforePhotos: z.array(z.object({ secureUrl: z.string().url(), publicId: z.string() })).optional().default([])
  })).default([])
});

export const findingUpdateSchema = z.object({
  severity: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  observation: z.string().trim().optional(),
  assignedTo: z.string().trim().optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "SUBMITTED", "CLOSED", "REJECTED", "REOPENED", "OVERDUE"]).optional(),
  beforePhotos: z.array(z.object({ secureUrl: z.string().url(), publicId: z.string() })).optional(),
  afterPhotos: z.array(z.object({ secureUrl: z.string().url(), publicId: z.string() })).optional()
});

export const findingCreateSchema = z.object({
  zone: z.string().trim().min(1),
  department: z.string().trim().min(1),
  category: z.string().trim().min(1),
  question: z.string().trim().min(1),
  severity: z.enum(["Critical", "High", "Medium", "Low"]).optional().default("Medium"),
  observation: z.string().trim().optional(),
  beforePhotos: z.array(z.object({ secureUrl: z.string().url(), publicId: z.string() })).optional().default([]),
  assignedTo: z.string().trim().optional(),
  dueDate: z.coerce.date().optional()
});

export const capaSchema = z.object({
  capaAction: z.string().trim().min(3),
  closureRemarks: z.string().trim().optional(),
  afterPhotos: z.array(z.object({ secureUrl: z.string().url(), publicId: z.string() })).default([])
});

export const reviewSchema = z.object({
  decision: z.enum(["approve", "reject", "reopen"]),
  remarks: z.string().trim().optional(),
  rejectionReason: z.string().trim().optional()
});

export const emailTemplateSchema = z.object({
  templateKey: z.string().trim().min(2).max(80),
  templateName: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(240),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
  supportedVariables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  triggerEvent: z.enum([
    "FINDING_ASSIGNED",
    "CAPA_SUBMITTED",
    "CAPA_APPROVED",
    "CAPA_REJECTED",
    "FINDING_REOPENED",
    "FINDING_OVERDUE",
    "AUDIT_COMPLETED",
    "AUDIT_REPORT_SHARED",
    "PASSWORD_CHANGED",
    "PASSWORD_RESET_REQUESTED",
    "USER_CREATED",
    "SUMMARY"
  ]),
  allowedRolesToReceive: z.array(roleSchema).default([]),
  ccRules: z.array(roleSchema).default([]),
  bccRules: z.array(roleSchema).default([])
});

export const testEmailSchema = z.object({
  to: z.string().email(),
  sampleData: z.record(z.string()).default({})
});
