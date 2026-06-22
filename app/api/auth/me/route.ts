import { getSessionUser } from "@/lib/auth";
import { ok } from "@/utils/api";

export async function GET() {
  return ok({ user: await getSessionUser() });
}
