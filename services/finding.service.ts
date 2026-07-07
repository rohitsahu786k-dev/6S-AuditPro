import Finding from "@/models/Finding";
import { connectDB } from "@/lib/db";
import type { SessionUser } from "@/types/domain";
import { resolveRecipients } from "@/services/email-recipient.service";
import { sendTemplatedEmail } from "@/services/email.service";

function scopedQuery(user: SessionUser) {
  return user.role.endsWith("_SPOC") && user.department ? { department: user.department } : {};
}

export async function listFindings(user: SessionUser) {
  await connectDB();
  await Finding.updateMany({ status: { $nin: ["CLOSED"] }, dueDate: { $lt: new Date() } }, { $set: { status: "OVERDUE" } });
  return Finding.find(scopedQuery(user)).sort({ createdAt: -1 }).lean();
}

export async function submitCapa(id: string, input: { capaAction: string; closureRemarks?: string; afterPhotos?: Array<{ secureUrl: string; publicId: string }> }, user: SessionUser) {
  await connectDB();
  const finding = await Finding.findOne({ _id: id, ...scopedQuery(user) });
  if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
  finding.capaAction = input.capaAction;
  finding.closureRemarks = input.closureRemarks;
  finding.set("afterPhotos", input.afterPhotos || []);
  finding.capaStatus = "SUBMITTED";
  finding.auditorReviewStatus = "PENDING";
  finding.status = "SUBMITTED";
  finding.timeline.push({ action: "CAPA submitted", note: input.capaAction, by: user.id, byName: user.name, at: new Date() });
  
  const saved = await finding.save();

  // Send CAPA Submitted Email (Async)
  resolveRecipients({ roles: ["MASTER_ADMIN", "ADMIN", "AUDITOR"] })
    .then((recipients) => {
      return sendTemplatedEmail({
        triggerEvent: "CAPA_SUBMITTED",
        recipients,
        data: {
          recipientName: "Auditor / Admin",
          findingNumber: saved.findingNumber,
          auditNumber: saved.auditNumber || "",
          departmentName: saved.department,
          zoneName: saved.zone,
          severity: saved.severity,
          question: saved.question,
          capaAction: saved.capaAction || "",
          closureRemarks: saved.closureRemarks || ""
        },
        relatedFindingId: saved._id.toString()
      });
    })
    .catch((err) => console.error("Error sending CAPA submitted email:", err));

  return saved;
}

export async function reviewCapa(id: string, input: { decision: "approve" | "reject" | "reopen"; remarks?: string; rejectionReason?: string }, user: SessionUser) {
  await connectDB();
  const finding = await Finding.findById(id);
  if (!finding) throw Object.assign(new Error("Finding not found"), { status: 404 });
  
  let triggerEvent = "CAPA_APPROVED";
  
  if (input.decision === "approve") {
    finding.status = "CLOSED";
    finding.capaStatus = "APPROVED";
    finding.auditorReviewStatus = "APPROVED";
    triggerEvent = "CAPA_APPROVED";
  } else if (input.decision === "reject") {
    finding.status = "REJECTED";
    finding.capaStatus = "REJECTED";
    finding.auditorReviewStatus = "REJECTED";
    finding.rejectionReason = input.rejectionReason || input.remarks;
    triggerEvent = "CAPA_REJECTED";
  } else {
    finding.status = "REOPENED";
    finding.capaStatus = "NOT_SUBMITTED";
    finding.auditorReviewStatus = "PENDING";
    triggerEvent = "FINDING_REOPENED";
  }
  
  finding.timeline.push({ action: `CAPA ${input.decision}`, note: input.remarks || input.rejectionReason, by: user.id, byName: user.name, at: new Date() });
  const saved = await finding.save();

  // Send review outcome email (Async)
  const rolesToNotify = input.decision === "approve" 
    ? ["STORES_SPOC", "PRODUCTION_SPOC", "ADMIN", "MASTER_ADMIN", "AUDITOR", "MANAGEMENT"]
    : ["STORES_SPOC", "PRODUCTION_SPOC", "ADMIN", "MASTER_ADMIN"];
    
  resolveRecipients({ department: saved.department, roles: rolesToNotify as any[] })
    .then((recipients) => {
      return sendTemplatedEmail({
        triggerEvent,
        recipients,
        data: {
          recipientName: "Team",
          findingNumber: saved.findingNumber,
          status: saved.status,
          closureRemarks: input.remarks || "",
          rejectionReason: saved.rejectionReason || ""
        },
        relatedFindingId: saved._id.toString()
      });
    })
    .catch((err) => console.error(`Error sending email for event ${triggerEvent}:`, err));

  return saved;
}
