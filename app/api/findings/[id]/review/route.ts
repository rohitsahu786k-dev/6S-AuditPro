import { requireUser } from "@/lib/auth";
import { reviewSchema } from "@/lib/validators";
import { reviewCapa } from "@/services/finding.service";
import { fail, ok, parseJson } from "@/utils/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser("capa:review");
    const { id } = await context.params;
    const input = await parseJson(request, reviewSchema);
    const finding = await reviewCapa(id, input, user);
    return ok(finding);
  } catch (error) {
    return fail(error);
  }
}
