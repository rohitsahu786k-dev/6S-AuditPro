import { requireUser } from "@/lib/auth";
import { emailTemplateSchema } from "@/lib/validators";
import { listEmailTemplates, upsertEmailTemplate } from "@/services/email-template.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function GET() {
  try {
    await requireUser("emailTemplates:read");
    return ok(await listEmailTemplates());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser("emailTemplates:create");
    const input = await parseJson(request, emailTemplateSchema);
    return ok(await upsertEmailTemplate(input, user.id), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
