import { requireUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { uploadImage } from "@/services/upload.service";
import { fail, ok, parseFormData } from "@/utils/api";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.permissions.includes("audits:create") && !user.permissions.includes("capa:submit")) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    // Each call bills a 5 MB-capped upload against a metered Cloudinary account.
    await consumeRateLimit("upload", user.id, 200, 60 * 60_000);
    const form = await parseFormData(request);
    const file = form.get("file");
    const requestedFolder = form.get("folderSuffix")?.toString() || "audit-photos";
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(requestedFolder)) {
      throw Object.assign(new Error("Invalid folderSuffix"), { status: 400 });
    }
    const folderSuffix = requestedFolder;
    if (!(file instanceof File)) throw Object.assign(new Error("file is required"), { status: 400 });
    return ok(await uploadImage(file, folderSuffix, { id: user.id, name: user.name }));
  } catch (error) {
    return fail(error);
  }
}
