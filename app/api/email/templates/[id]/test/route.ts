import EmailTemplate from "@/models/EmailTemplate";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { renderTemplate } from "@/lib/email-template-renderer";
import { createTransporter, fromAddress } from "@/lib/mailer";
import { testEmailSchema } from "@/lib/validators";
import { logEmail } from "@/services/email-log.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser("emailTemplates:update");
    const { id } = await context.params;
    const input = await parseJson(request, testEmailSchema);
    await connectDB();
    const template = await EmailTemplate.findById(id).lean();
    if (!template) throw Object.assign(new Error("Template not found"), { status: 404 });
    const data = { companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "ONEPWS Private Limited", appUrl: process.env.APP_BASE_URL || "http://localhost:3000", ...input.sampleData };
    const subject = renderTemplate(template.subject, data).rendered;
    const html = renderTemplate(template.htmlBody, data).rendered;
    const text = renderTemplate(template.textBody, data).rendered;
    await createTransporter().sendMail({ from: fromAddress(), to: input.to, subject, html, text });
    await logEmail({ templateKey: template.templateKey, triggerEvent: template.triggerEvent, recipients: [input.to], subject, status: "sent", sentBySystem: false });
    return ok({ sent: true });
  } catch (error) {
    return fail(error);
  }
}
