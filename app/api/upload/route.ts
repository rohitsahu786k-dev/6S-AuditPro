import { requireUser } from "@/lib/auth";
import { uploadImage } from "@/services/upload.service";
import { fail, ok } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.permissions.includes("audits:create") && !user.permissions.includes("capa:submit")) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw Object.assign(new Error("file is required"), { status: 400 });
    return ok(await uploadImage(file));
  } catch (error) {
    return fail(error);
  }
}
