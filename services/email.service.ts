import { COMPANY_NAME } from "@/lib/constants";
import { EMAIL_LOGO_URL } from "@/lib/email-layout";
import { renderTemplate } from "@/lib/email-template-renderer";
import { createTransporter, fromAddress } from "@/lib/mailer";
import { getActiveTemplate } from "@/services/email-template.service";
import { logEmail } from "@/services/email-log.service";

export async function sendTemplatedEmail(input: {
  triggerEvent: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  data: Record<string, string | number | undefined | null>;
  relatedAuditId?: string;
  relatedFindingId?: string;
}) {
  const template = await getActiveTemplate(input.triggerEvent);
  if (!template) {
    return logEmail({ triggerEvent: input.triggerEvent, recipients: input.recipients, status: "skipped", errorMessage: "No active template" });
  }
  if (!input.recipients.length) {
    return logEmail({ templateKey: template.templateKey, triggerEvent: input.triggerEvent, recipients: [], status: "skipped", errorMessage: "No recipients" });
  }

  const data = {
    companyName: COMPANY_NAME,
    appUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    logoUrl: EMAIL_LOGO_URL,
    ...input.data
  };
  const subject = renderTemplate(template.subject, data).rendered;
  const html = renderTemplate(template.htmlBody, data).rendered;
  const text = renderTemplate(template.textBody, data).rendered;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: fromAddress(),
      to: input.recipients,
      cc: input.cc,
      bcc: input.bcc,
      subject,
      html,
      text
    });
    return logEmail({ templateKey: template.templateKey, triggerEvent: input.triggerEvent, recipients: input.recipients, cc: input.cc, bcc: input.bcc, subject, status: "sent", relatedAuditId: input.relatedAuditId, relatedFindingId: input.relatedFindingId, sentBySystem: true });
  } catch (error) {
    return logEmail({ templateKey: template.templateKey, triggerEvent: input.triggerEvent, recipients: input.recipients, cc: input.cc, bcc: input.bcc, subject, status: "failed", errorMessage: error instanceof Error ? error.message : "SMTP failure", relatedAuditId: input.relatedAuditId, relatedFindingId: input.relatedFindingId, sentBySystem: true });
  }
}
