import EmailTemplate from "@/models/EmailTemplate";
import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { emailTemplateSchema } from "@/lib/validators";
import { fail, ok, parseJson } from "@/utils/api";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("emailTemplates:update");
    const { id } = await context.params;
    const input = await parseJson(request, emailTemplateSchema.partial());
    await connectDB();
    return ok(await EmailTemplate.findByIdAndUpdate(id, { ...input, updatedBy: user.id }, { new: true }));
  } catch (error) {
    return fail(error);
  }
}
