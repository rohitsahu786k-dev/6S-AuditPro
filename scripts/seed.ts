import "dotenv/config";
import { connectDB } from "@/lib/db";
import { DEFAULT_DEPARTMENTS, DEFAULT_QUESTIONS, DEFAULT_ZONES, EMAIL_VARIABLES } from "@/lib/constants";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email-template-defaults";
import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import EmailTemplate from "@/models/EmailTemplate";
import User from "@/models/User";
import { createUser } from "@/services/user.service";

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

  for (const { templateKey, templateName, triggerEvent, subject, htmlBody, textBody } of DEFAULT_EMAIL_TEMPLATES) {
    await EmailTemplate.updateOne(
      { templateKey },
      {
        $setOnInsert: {
          templateKey,
          templateName,
          triggerEvent,
          subject,
          htmlBody,
          textBody,
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
