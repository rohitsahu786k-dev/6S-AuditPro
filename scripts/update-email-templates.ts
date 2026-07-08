import "dotenv/config";
import { connectDB } from "@/lib/db";
import { EMAIL_VARIABLES } from "@/lib/constants";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email-template-defaults";
import EmailTemplate from "@/models/EmailTemplate";

async function main() {
  await connectDB();

  for (const { templateKey, templateName, triggerEvent, subject, htmlBody, textBody } of DEFAULT_EMAIL_TEMPLATES) {
    const result = await EmailTemplate.updateOne(
      { templateKey },
      {
        $set: { templateName, triggerEvent, subject, htmlBody, textBody, supportedVariables: EMAIL_VARIABLES },
        $setOnInsert: { templateKey, isActive: true, allowedRolesToReceive: [], ccRules: [], bccRules: [] }
      },
      { upsert: true }
    );
    console.log(templateKey, result.upsertedCount ? "created" : "updated");
  }

  console.log("Email template refresh complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
