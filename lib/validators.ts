import { z } from "zod";

export const roleSchema = z.enum(["MASTER_ADMIN", "ADMIN", "AUDITOR", "SPOC", "MANAGEMENT"]);
export const emailSchema = z.string().email().optional().or(z.literal(""));
const newPasswordSchema = z.string().min(8).max(72).refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 bytes");

/**
 * Photo references come back from our own upload route, but they are re-submitted
 * by the client when a finding or checklist row is saved, so the URL has to be
 * re-checked here. These values are rendered into notification emails and exported
 * PDFs: an arbitrary URL would let a caller plant a tracking pixel that fires when
 * a manager opens the mail, or swap the evidence image after it was approved.
 * MEDIA_URL_HOSTS overrides the default for self-hosted or proxied media.
 */
const mediaHosts = () => (process.env.MEDIA_URL_HOSTS || "res.cloudinary.com")
  .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);

export const mediaUrlSchema = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && mediaHosts().includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}, "Photo URL must be an https URL on an approved media host");

export const photoSchema = z.object({
  secureUrl: mediaUrlSchema,
  publicId: z.string().trim().max(300),
  sizeBytes: z.number().optional(),
  uploadedBy: z.string().trim().max(64).optional(),
  uploadedByName: z.string().trim().max(120).optional()
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200)
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).toLowerCase(),
  email: emailSchema,
  password: newPasswordSchema,
  role: roleSchema,
  department: z.string().trim().optional(),
  zone: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial().extend({
  password: newPasswordSchema.optional()
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: newPasswordSchema
});

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).toLowerCase(),
  email: z.string().trim().email(),
  password: newPasswordSchema
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  newPassword: newPasswordSchema
});

const optionalDateSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.date().optional()
);

export const auditSchema = z.object({
  auditType: z.enum(["STANDARD", "ADHOC"]).optional().default("STANDARD"),
  title: z.string().trim().max(180).optional(),
  description: z.string().trim().max(2000).optional(),
  zone: z.string().trim().min(1).max(180),
  department: z.string().trim().min(1).max(120),
  auditorName: z.string().trim().min(1).max(180),
  date: optionalDateSchema,
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  checklist: z.array(z.object({
    questionId: z.string().max(120),
    sourceRowNumber: z.number().int().positive().optional(),
    importBatchId: z.string().trim().optional(),
    category: z.string().max(120),
    question: z.string().max(2000),
    response: z.enum(["Adequate", "Not Adequate", "N/A"]),
    observation: z.string().max(4000).optional(),
    severity: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
    actionOwnerId: z.string().trim().optional(),
    actionOwnerUserId: z.string().trim().optional(),
    actionOwnerName: z.string().trim().max(180).optional(),
    actionOwnerDepartment: z.string().trim().max(120).optional(),
    dueDate: optionalDateSchema,
    remarks: z.string().trim().max(2000).optional(),
    beforePhotos: z.array(photoSchema).optional().default([])
  })).max(1000).default([])
  ,
  importMetadata: z.object({
    originalFileName: z.string().trim().max(260),
    totalRows: z.number().int().nonnegative(),
    successfulRows: z.number().int().nonnegative(),
    failedRows: z.number().int().nonnegative(),
    importBatchId: z.string().trim().min(1),
    fileHash: z.string().trim().min(16)
  }).optional()
}).refine((input) => input.startDate || input.date, {
  message: "Starting Date is required.",
  path: ["startDate"]
}).refine((input) => {
  const startDate = input.startDate || input.date;
  return !startDate || !input.endDate || input.endDate >= startDate;
}, {
  message: "Ending Date cannot be earlier than Starting Date.",
  path: ["endDate"]
}).refine((input) => input.auditType !== "ADHOC" || Boolean(input.title?.trim()), {
  message: "Audit Title is required for Adhoc Audit.",
  path: ["title"]
}).refine((input) => input.auditType !== "ADHOC" || input.checklist.length > 0, {
  message: "At least one imported Adhoc observation is required.",
  path: ["checklist"]
});

export const auditUpdateSchema = z.object({
  date: optionalDateSchema,
  startDate: optionalDateSchema,
  endDate: optionalDateSchema
}).refine((input) => {
  const startDate = input.startDate || input.date;
  return !startDate || !input.endDate || input.endDate >= startDate;
}, {
  message: "Ending Date cannot be earlier than Starting Date.",
  path: ["endDate"]
});

export const findingUpdateSchema = z.object({
  severity: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  observation: z.string().trim().max(4000).optional(),
  department: z.string().trim().max(120).optional(),
  assignedTo: z.string().trim().max(180).optional(),
  assignedUser: z.string().trim().max(64).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "SUBMITTED", "CLOSED", "REJECTED", "REOPENED", "OVERDUE"]).optional(),
  beforePhotos: z.array(photoSchema).optional(),
  afterPhotos: z.array(photoSchema).optional()
});

export const findingCreateSchema = z.object({
  zone: z.string().trim().min(1).max(180),
  department: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(2000),
  severity: z.enum(["Critical", "High", "Medium", "Low"]).optional().default("Medium"),
  observation: z.string().trim().max(4000).optional(),
  beforePhotos: z.array(photoSchema).optional().default([]),
  assignedTo: z.string().trim().max(180).optional(),
  dueDate: z.coerce.date().optional()
});

export const capaSchema = z.object({
  capaAction: z.string().trim().min(3).max(4000),
  closureRemarks: z.string().trim().max(4000).optional(),
  afterPhotos: z.array(photoSchema).default([])
});

export const reviewSchema = z.object({
  decision: z.enum(["approve", "reject", "reopen"]),
  remarks: z.string().trim().max(4000).optional(),
  rejectionReason: z.string().trim().max(4000).optional()
});

export const emailTemplateSchema = z.object({
  templateKey: z.string().trim().min(2).max(80),
  templateName: z.string().trim().min(2).max(160),
  subject: z.string().trim().min(2).max(240),
  htmlBody: z.string().min(1).max(200_000),
  textBody: z.string().min(1).max(100_000),
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

export const shareReportSchema = z.object({
  email: z.string().trim().email()
});

export const retryEmailSchema = z.object({
  logId: z.string().trim().min(1).max(64)
});
