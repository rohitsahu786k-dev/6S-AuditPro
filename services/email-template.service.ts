import EmailTemplate from "@/models/EmailTemplate";
import { connectDB } from "@/lib/db";
import { EMAIL_VARIABLES } from "@/lib/constants";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email-template-defaults";
import { variablesInTemplate } from "@/lib/email-template-renderer";

async function ensureDefaultEmailTemplates() {
  await EmailTemplate.bulkWrite(DEFAULT_EMAIL_TEMPLATES.map((template) => ({
    updateOne: {
      filter: { templateKey: template.templateKey },
      update: {
        $setOnInsert: {
          ...template,
          supportedVariables: EMAIL_VARIABLES,
          isActive: true,
          allowedRolesToReceive: [],
          ccRules: [],
          bccRules: []
        }
      },
      upsert: true
    }
  })));

  // Rename the legacy default without overwriting any administrator-customized copy.
  await EmailTemplate.updateOne(
    { templateKey: "finding-overdue", templateName: "Finding Overdue Reminder" },
    { $set: { templateName: "Manager / HOD Overdue Escalation" } }
  );
}

export async function listEmailTemplates() {
  await connectDB();
  await ensureDefaultEmailTemplates();
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
  const existing = await EmailTemplate.findOne({ triggerEvent, isActive: true }).lean();
  if (existing) return existing;
  await ensureDefaultEmailTemplates();
  return EmailTemplate.findOne({ triggerEvent, isActive: true }).lean();
}
