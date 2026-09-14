import EmailTemplate from "@/models/EmailTemplate";
import { getAppUrl } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/db";
import { EMAIL_LOGO_URL } from "@/lib/email-layout";
import { renderTemplate } from "@/lib/email-template-renderer";
import { createTransporter, fromAddress } from "@/lib/mailer";
import { testEmailSchema } from "@/lib/validators";
import { logEmail } from "@/services/email-log.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("emailTemplates:update");
    const { id } = await context.params;
    const input = await parseJson(request, testEmailSchema);
    // Caller supplies both the recipient and the substituted values.
    await consumeRateLimit("email-template-test", user.id, 30, 60 * 60_000);
    await connectDB();
    const template = await EmailTemplate.findById(id).lean();
    if (!template) throw Object.assign(new Error("Template not found"), { status: 404 });
    const data = { companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "OnePWS Private Limited", appUrl: getAppUrl(), logoUrl: EMAIL_LOGO_URL, ...input.sampleData };
    const subject = renderTemplate(template.subject, data, "text").rendered;
    const html = renderTemplate(template.htmlBody, data).rendered;
    const text = renderTemplate(template.textBody, data, "text").rendered;
    await createTransporter().sendMail({ from: fromAddress(), to: input.to, subject, html, text });
    await logEmail({ templateKey: template.templateKey, triggerEvent: template.triggerEvent, recipients: [input.to], subject, status: "sent", sentBySystem: false });
    return ok({ sent: true });
  } catch (error) {
    return fail(error);
  }
}
