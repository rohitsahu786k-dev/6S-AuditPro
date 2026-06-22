import EmailTemplate from "@/models/EmailTemplate";
import { connectDB } from "@/lib/db";
import { EMAIL_VARIABLES } from "@/lib/constants";
import { variablesInTemplate } from "@/lib/email-template-renderer";

export async function listEmailTemplates() {
  await connectDB();
  return EmailTemplate.find().sort({ triggerEvent: 1, templateName: 1 }).lean();
}

export async function upsertEmailTemplate(input: Record<string, unknown>, userId?: string) {
  await connectDB();
  const supportedVariables = variablesInTemplate(String(input.subject || ""), String(input.htmlBody || ""), String(input.textBody || ""))
    .filter((v) => EMAIL_VARIABLES.includes(v));
  return EmailTemplate.findOneAndUpdate(
    { templateKey: input.templateKey },
    { ...input, supportedVariables, updatedBy: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function getActiveTemplate(triggerEvent: string) {
  await connectDB();
  return EmailTemplate.findOne({ triggerEvent, isActive: true }).lean();
}
