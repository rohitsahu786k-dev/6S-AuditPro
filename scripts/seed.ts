import "dotenv/config";
import { connectDB } from "@/lib/db";
import { DEFAULT_DEPARTMENTS, DEFAULT_QUESTIONS, DEFAULT_ZONES, EMAIL_VARIABLES } from "@/lib/constants";
import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import EmailTemplate from "@/models/EmailTemplate";
import User from "@/models/User";
import { createUser } from "@/services/user.service";

const defaultTemplates = [
  ["finding-assigned", "Finding Assigned", "FINDING_ASSIGNED", "Finding {{findingNumber}} assigned to {{departmentName}}"],
  ["capa-submitted", "CAPA Submitted", "CAPA_SUBMITTED", "CAPA submitted for {{findingNumber}}"],
  ["capa-approved", "CAPA Approved / Finding Closed", "CAPA_APPROVED", "Finding {{findingNumber}} closed"],
  ["capa-rejected", "CAPA Rejected", "CAPA_REJECTED", "CAPA rejected for {{findingNumber}}"],
  ["finding-overdue", "Finding Overdue Reminder", "FINDING_OVERDUE", "Finding {{findingNumber}} is overdue"],
  ["audit-completed", "Audit Completed", "AUDIT_COMPLETED", "Audit {{auditNumber}} completed"],
  ["audit-report-shared", "Audit Report Shared", "AUDIT_REPORT_SHARED", "Audit report {{auditNumber}} shared"],
  ["password-changed", "Password Changed", "PASSWORD_CHANGED", "Password changed for {{recipientName}}"],
  ["user-created", "User Created / Account Activated", "USER_CREATED", "Your 6S AuditPro account is active"],
  ["summary", "Daily or Weekly Summary", "SUMMARY", "6S AuditPro summary"]
] as const;

async function main() {
  await connectDB();

  for (const name of DEFAULT_DEPARTMENTS) {
    await Department.updateOne({ name }, { $setOnInsert: { name, isActive: true } }, { upsert: true });
  }
  for (const zone of DEFAULT_ZONES) {
    await Zone.updateOne({ name: zone.name }, { $setOnInsert: { ...zone, isActive: true } }, { upsert: true });
  }
  for (const [index, question] of DEFAULT_QUESTIONS.entries()) {
    await Question.updateOne({ text: question.text }, { $setOnInsert: { ...question, sortOrder: index + 1, isActive: true } }, { upsert: true });
  }
  await Person.updateOne({ name: "Lead Auditor", type: "AUDITOR" }, { $setOnInsert: { name: "Lead Auditor", type: "AUDITOR", roleTitle: "Lead Auditor", isActive: true } }, { upsert: true });

  for (const [templateKey, templateName, triggerEvent, subject] of defaultTemplates) {
    await EmailTemplate.updateOne(
      { templateKey },
      {
        $setOnInsert: {
          templateKey,
          templateName,
          triggerEvent,
          subject,
          htmlBody: `<p>Hello {{recipientName}},</p><p>${subject}</p><p><a href="{{appUrl}}">Open 6S AuditPro</a></p><p>${"{{companyName}}"}</p>`,
          textBody: `Hello {{recipientName}},\n${subject}\nOpen: {{appUrl}}\n{{companyName}}`,
          supportedVariables: EMAIL_VARIABLES,
          isActive: true,
          allowedRolesToReceive: [],
          ccRules: [],
          bccRules: []
        }
      },
      { upsert: true }
    );
  }

  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const existing = await User.findOne({ username });
  if (!existing) {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) throw new Error("SEED_ADMIN_PASSWORD is required to create the first Master Admin.");
    await createUser({
      name: process.env.SEED_ADMIN_NAME || "Master Admin",
      username,
      email: process.env.SEED_ADMIN_EMAIL,
      password,
      role: "MASTER_ADMIN",
      department: "All"
    });
  }

  console.log("Seed completed.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
