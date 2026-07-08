import { requireUser } from "@/lib/auth";
import { listFindings, type FindingListView } from "@/services/finding.service";
import { fail, ok, parseJson } from "@/utils/api";
import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";
import { findingCreateSchema } from "@/lib/validators";

const FINDING_VIEWS = new Set<FindingListView>(["full", "summary", "register", "media-selector"]);

export async function GET(request: Request) {
  try {
    const user = await requireUser("findings:read");
    const viewParam = new URL(request.url).searchParams.get("view") || "full";
    const view = FINDING_VIEWS.has(viewParam as FindingListView) ? viewParam as FindingListView : "full";
    return ok(await listFindings(user, view));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser("findings:update");
    const body = await parseJson(request, findingCreateSchema);
    await connectDB();

    const count = await Finding.countDocuments();
    const findingNumber = `FND-${String(count + 1).padStart(5, "0")}`;

    const newFinding = new Finding({
      findingNumber,
      zone: body.zone,
      department: body.department,
      category: body.category,
      question: body.question,
      severity: body.severity || "Medium",
      observation: body.observation || "",
      beforePhotos: body.beforePhotos || [],
      assignedTo: body.assignedTo || body.department,
      dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "OPEN",
      createdBy: user.id,
      timeline: [{ 
        action: "Ad-hoc finding created", 
        note: body.observation || "Created manually", 
        by: user.id, 
        byName: user.name,
        at: new Date()
      }]
    });

    const saved = await newFinding.save();

    // Notify SPOC and Admin
    resolveRecipients({ department: saved.department, roles: ["SPOC", "ADMIN", "MASTER_ADMIN"] })
      .then((recipients) => {
        return sendTemplatedEmail({
          triggerEvent: "FINDING_ASSIGNED",
          recipients,
          data: {
            recipientName: "Department SPOC",
            findingNumber: saved.findingNumber,
            auditNumber: "AD-HOC",
            departmentName: saved.department,
            zoneName: saved.zone,
            severity: saved.severity,
            dueDate: saved.dueDate ? new Date(saved.dueDate).toLocaleDateString() : "",
            question: saved.question,
            assignedTo: saved.assignedTo || saved.department,
            auditorName: user.name
          },
          relatedFindingId: saved._id.toString()
        });
      })
      .catch((err) => console.error("Error sending email notification:", err));

    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}
