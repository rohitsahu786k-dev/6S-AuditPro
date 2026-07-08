import "dotenv/config";
import { connectDB } from "@/lib/db";
import EmailTemplate from "@/models/EmailTemplate";
import fs from "fs";

async function main() {
  await connectDB();
  const docs = await EmailTemplate.find().lean();
  fs.writeFileSync("scripts/email-templates-backup-2026-07-08.json", JSON.stringify(docs, null, 2));
  console.log("Backed up", docs.length, "templates");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
