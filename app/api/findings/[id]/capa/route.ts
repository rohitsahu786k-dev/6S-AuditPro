import { requireUser } from "@/lib/auth";
import { capaSchema } from "@/lib/validators";
import { submitCapa } from "@/services/finding.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("capa:submit");
    const { id } = await context.params;
    const input = await parseJson(request, capaSchema);
    const finding = await submitCapa(id, input, user);
    return ok(finding);
  } catch (error) {
    return fail(error);
  }
}
