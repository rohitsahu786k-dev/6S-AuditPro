import { requireUser } from "@/lib/auth";
import { buildAdhocTemplateWorkbook } from "@/lib/adhoc-excel";
import { fail } from "@/utils/api";

export async function GET() {
  try {
    await requireUser("audits:create");
    const buffer = buildAdhocTemplateWorkbook();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"Adhoc-6S-Audit-Template.xlsx\"",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return fail(error);
  }
}
