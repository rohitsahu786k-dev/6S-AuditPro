import { requireUser } from "@/lib/auth";
import { createTransporter } from "@/lib/mailer";
import { fail, ok } from "@/utils/api";

export async function POST() {
  try {
    await requireUser("settings:manage");
    await createTransporter().verify();
    return ok({ smtp: "ok" });
  } catch (error) {
    return fail(error);
  }
}
