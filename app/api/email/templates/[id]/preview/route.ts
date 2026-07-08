import EmailTemplate from "@/models/EmailTemplate";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EMAIL_LOGO_URL } from "@/lib/email-layout";
import { renderTemplate } from "@/lib/email-template-renderer";
import { fail, ok } from "@/utils/api";

const sample = {
  recipientName: "Department SPOC",
  auditNumber: "6S-2026-0001",
  findingNumber: "6S-2026-0001-F01",
  departmentName: "Stores",
  zoneName: "Raw Material Store",
  severity: "High",
  dueDate: "2026-06-30",
  assignedTo: "Stores SPOC",
  auditorName: "Lead Auditor",
  status: "OPEN",
  totalScore: "92%",
  capaAction: "Clean and label the storage rack",
  closureRemarks: "Action completed",
  rejectionReason: "Photo evidence is unclear",
  resetUrl: `${process.env.APP_BASE_URL || "http://localhost:3000"}/reset-password?token=sample-token`,
  appUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "OnePWS Private Limited",
  logoUrl: EMAIL_LOGO_URL
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("emailTemplates:read");
    const { id } = await context.params;
    await connectDB();
    const template = await EmailTemplate.findById(id).lean();
    if (!template) throw Object.assign(new Error("Template not found"), { status: 404 });
    return ok({
      subject: renderTemplate(template.subject, sample),
      html: renderTemplate(template.htmlBody, sample),
      text: renderTemplate(template.textBody, sample),
      sample
    });
  } catch (error) {
    return fail(error);
  }
}
