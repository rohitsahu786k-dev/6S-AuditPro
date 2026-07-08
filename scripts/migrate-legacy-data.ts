import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { configureCloudinary } from "@/lib/cloudinary";
import Department from "@/models/Department";
import Zone from "@/models/Zone";
import Question from "@/models/Question";
import Person from "@/models/Person";
import User from "@/models/User";
import Audit from "@/models/Audit";
import Finding from "@/models/Finding";
import type { Role } from "@/types/domain";

const EXPORT_PATH = path.join(process.cwd(), "fir-audit-portal-default-rtdb-export.json");

type LegacyPhoto = string; // data:image/... base64 string
type PhotoRef = { secureUrl: string; publicId: string };
const uploadedPhotoCache = new Map<string, Promise<PhotoRef | null>>();
let warnedMissingCloudinary = false;

function toArray<T>(obj: Record<string, T> | T[] | undefined): T[] {
  if (!obj) return [];
  return Array.isArray(obj) ? obj : Object.values(obj);
}

function mapResponse(st: string): "Adequate" | "Not Adequate" | "N/A" {
  if (st === "ok") return "Adequate";
  if (st === "bad") return "Not Adequate";
  return "N/A";
}

function mapFindingStatus(status: string): "OPEN" | "CLOSED" | "REOPENED" {
  if (status === "Closed") return "CLOSED";
  if (status === "Reopened") return "REOPENED";
  return "OPEN";
}

function mapUserRole(role: string): Role {
  if (role === "admin") return "MASTER_ADMIN";
  if (role === "auditor") return "AUDITOR";
  if (role === "spoc") return "SPOC";
  if (role === "management") return "MANAGEMENT";
  return "AUDITOR";
}

function photoHash(dataUri: string) {
  return crypto.createHash("sha256").update(dataUri).digest("hex");
}

function fallbackPhotoRef(dataUri: LegacyPhoto): PhotoRef {
  return {
    secureUrl: dataUri,
    publicId: `legacy-unmigrated/${photoHash(dataUri).slice(0, 24)}`
  };
}

async function uploadLegacyPhoto(dataUri: LegacyPhoto, folderSuffix: string, label: string): Promise<PhotoRef | null> {
  if (!dataUri || !dataUri.startsWith("data:image/")) {
    console.warn(`  skipping invalid legacy photo for ${label}`);
    return null;
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    if (!warnedMissingCloudinary) {
      console.warn("  Cloudinary credentials are not configured; preserving legacy photos in MongoDB until credentials are added.");
      warnedMissingCloudinary = true;
    }
    return null;
  }

  const hash = photoHash(dataUri);
  const cached = uploadedPhotoCache.get(hash);
  if (cached) return cached;

  const uploadPromise = (async () => {
    const cloudinary = configureCloudinary();
    const folder = `${process.env.CLOUDINARY_UPLOAD_FOLDER || "onepws-6s-auditpro"}/${folderSuffix}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: `legacy-${hash.slice(0, 24)}`,
      overwrite: false,
      resource_type: "image"
    });
    return { secureUrl: result.secure_url, publicId: result.public_id };
  })().catch((error) => {
    console.warn(`  failed to upload legacy photo for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });

  uploadedPhotoCache.set(hash, uploadPromise);
  return uploadPromise;
}

async function photosToRefs(photos: LegacyPhoto[] | undefined, folderSuffix: string, label: string): Promise<PhotoRef[]> {
  if (!photos || !photos.length) return [];
  const refs: PhotoRef[] = [];
  for (const [index, dataUri] of photos.entries()) {
    const ref = await uploadLegacyPhoto(dataUri, folderSuffix, `${label} photo ${index + 1}`);
    refs.push(ref || fallbackPhotoRef(dataUri));
  }
  return refs;
}

async function normalizeExistingPhotoRefs() {
  let auditsUpdated = 0;
  let findingsUpdated = 0;

  const auditsWithEmbeddedPhotos = await Audit.find({ "checklist.beforePhotos.secureUrl": /^data:image\// });
  for (const audit of auditsWithEmbeddedPhotos) {
    let changed = false;
    for (const item of audit.checklist) {
      if (!item.beforePhotos?.length) continue;
      const normalizedPhotos: PhotoRef[] = [];
      for (const [index, photo] of item.beforePhotos.entries()) {
        if (photo.secureUrl?.startsWith("data:image/")) {
          const ref = await uploadLegacyPhoto(photo.secureUrl, "legacy-audit-photos", `existing audit ${audit.auditNumber} photo ${index + 1}`);
          normalizedPhotos.push(ref || fallbackPhotoRef(photo.secureUrl));
          changed = true;
        } else if (photo.secureUrl && photo.publicId) {
          normalizedPhotos.push({ secureUrl: photo.secureUrl, publicId: photo.publicId });
        }
      }
      item.beforePhotos = normalizedPhotos as any;
    }
    if (changed) {
      await audit.save();
      auditsUpdated += 1;
    }
  }

  const findingsWithEmbeddedPhotos = await Finding.find({
    $or: [
      { "beforePhotos.secureUrl": /^data:image\// },
      { "afterPhotos.secureUrl": /^data:image\// }
    ]
  });
  for (const finding of findingsWithEmbeddedPhotos) {
    let changed = false;
    const normalizeList = async (photos: any[] | undefined, folderSuffix: string, label: string) => {
      const normalizedPhotos: PhotoRef[] = [];
      for (const [index, photo] of (photos || []).entries()) {
        if (photo.secureUrl?.startsWith("data:image/")) {
          const ref = await uploadLegacyPhoto(photo.secureUrl, folderSuffix, `${label} photo ${index + 1}`);
          normalizedPhotos.push(ref || fallbackPhotoRef(photo.secureUrl));
          changed = true;
        } else if (photo.secureUrl && photo.publicId) {
          normalizedPhotos.push({ secureUrl: photo.secureUrl, publicId: photo.publicId });
        }
      }
      return normalizedPhotos;
    };

    finding.beforePhotos = await normalizeList(finding.beforePhotos as any[], "legacy-finding-before", `existing finding ${finding.findingNumber} before`) as any;
    finding.afterPhotos = await normalizeList(finding.afterPhotos as any[], "legacy-finding-after", `existing finding ${finding.findingNumber} after`) as any;
    if (changed) {
      await finding.save();
      findingsUpdated += 1;
    }
  }

  console.log(`Existing embedded media normalized: ${auditsUpdated} audits, ${findingsUpdated} findings updated.`);
}

async function restoreMissingLegacyMedia(input: {
  legacyAudits: any[];
  legacyFindings: any[];
  deletedAuditIds: Set<string>;
  deletedFindingIds: Set<string>;
  legacyAuditIdToNumber: Map<string, string>;
}) {
  let auditsRestored = 0;
  let findingsRestored = 0;

  for (const legacyAudit of input.legacyAudits) {
    if (input.deletedAuditIds.has(legacyAudit.id)) continue;
    const audit = await Audit.findOne({ auditNumber: legacyAudit.number });
    if (!audit) continue;
    let changed = false;
    for (const item of audit.checklist) {
      if (item.beforePhotos?.length) continue;
      const response = legacyAudit.responses?.[item.questionId || ""];
      if (!response?.photos?.length) continue;
      item.beforePhotos = await photosToRefs(response.photos, "legacy-audit-photos", `restore audit ${audit.auditNumber} question ${item.questionId}`) as any;
      changed = true;
    }
    if (changed) {
      await audit.save();
      auditsRestored += 1;
    }
  }

  const restoreCounterByAudit = new Map<string, number>();
  for (const legacyFinding of input.legacyFindings) {
    if (input.deletedFindingIds.has(legacyFinding.id)) continue;
    const auditNumber = input.legacyAuditIdToNumber.get(legacyFinding.auditId) || legacyFinding.auditNumber;
    if (!auditNumber) continue;

    const seq = (restoreCounterByAudit.get(auditNumber) || 0) + 1;
    restoreCounterByAudit.set(auditNumber, seq);
    const findingNumber = `${auditNumber}-F${String(seq).padStart(2, "0")}`;
    const finding = await Finding.findOne({ findingNumber });
    if (!finding) continue;

    let changed = false;
    if (!finding.beforePhotos?.length && legacyFinding.photos?.length) {
      finding.beforePhotos = await photosToRefs(legacyFinding.photos, "legacy-finding-before", `restore finding ${findingNumber} before`) as any;
      changed = true;
    }
    if (!finding.afterPhotos?.length && legacyFinding.afterPhotos?.length) {
      finding.afterPhotos = await photosToRefs(legacyFinding.afterPhotos, "legacy-finding-after", `restore finding ${findingNumber} after`) as any;
      changed = true;
    }
    if (changed) {
      await finding.save();
      findingsRestored += 1;
    }
  }

  console.log(`Missing legacy media restored: ${auditsRestored} audits, ${findingsRestored} findings updated.`);
}

async function main() {
  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Legacy export file not found at ${EXPORT_PATH}`);
  }
  await connectDB();

  const raw = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const v1 = raw.auditpro.v1;

  const legacyDepartments: string[] = toArray<string>(v1.departments).filter((d) => d !== "<Spare For Future>");
  const legacyZones = toArray(v1.zones) as Array<{ id: string; name: string; dept: string; loc?: string }>;
  const legacyQuestions = toArray(v1.questions) as Array<{ id: string; cat: string; text: string; active?: boolean }>;
  const legacyAuditors = toArray(v1.auditors) as Array<{ id: string; name: string; role: string }>;
  const legacyResponsible = toArray(v1.responsible) as Array<{ id: string; name: string; dept: string }>;
  const legacyUsers = toArray(v1.users) as Array<{ id: string; name: string; username: string; password: string; role: string; dept?: string }>;
  const legacyAudits = toArray(v1.audits) as any[];
  const legacyFindings = toArray(v1.findings) as any[];
  const deletedAuditIds = new Set(Object.keys(v1.deleted?.audits || {}));
  const deletedFindingIds = new Set(Object.keys(v1.deleted?.findings || {}));

  console.log(`Legacy data: ${legacyDepartments.length} departments, ${legacyZones.length} zones, ${legacyQuestions.length} questions, ${legacyUsers.length} users, ${legacyAudits.length} audits (${deletedAuditIds.size} deleted), ${legacyFindings.length} findings (${deletedFindingIds.size} deleted)`);

  // 1. Departments
  for (const name of legacyDepartments) {
    await Department.updateOne({ name }, { $setOnInsert: { name, isActive: true } }, { upsert: true });
  }
  console.log("Departments migrated.");

  // 2. Zones
  for (const zone of legacyZones) {
    await Zone.updateOne(
      { name: zone.name },
      { $setOnInsert: { name: zone.name, department: zone.dept, location: zone.loc, isActive: true } },
      { upsert: true }
    );
  }
  console.log("Zones migrated.");

  // 3. Questions
  for (const [index, q] of legacyQuestions.entries()) {
    await Question.updateOne(
      { text: q.text },
      { $setOnInsert: { category: q.cat, text: q.text, isActive: q.active !== false, sortOrder: index + 1 } },
      { upsert: true }
    );
  }
  console.log("Questions migrated.");

  // 4. People (auditors + responsible)
  for (const a of legacyAuditors) {
    await Person.updateOne(
      { name: a.name, type: "AUDITOR" },
      { $setOnInsert: { name: a.name, type: "AUDITOR", roleTitle: a.role, isActive: true } },
      { upsert: true }
    );
  }
  for (const r of legacyResponsible) {
    await Person.updateOne(
      { name: r.name, type: "RESPONSIBLE" },
      { $setOnInsert: { name: r.name, type: "RESPONSIBLE", department: r.dept, isActive: true } },
      { upsert: true }
    );
  }
  console.log("People migrated.");

  // 5. Users (skip usernames that already exist, e.g. the seeded admin)
  const userIdToMongoId = new Map<string, string>();
  const userNameToMongoId = new Map<string, string>();
  for (const u of legacyUsers) {
    const username = u.username.toLowerCase();
    let existing = await User.findOne({ username });
    if (!existing) {
      const passwordHash = await hashPassword(u.password);
      existing = await User.create({
        name: u.name,
        username,
        passwordHash,
        role: mapUserRole(u.role),
        department: u.dept && u.dept !== "All" ? u.dept : undefined,
        status: "active",
        permissions: [],
        passwordChangedAt: new Date(),
        forcePasswordChange: true
      });
      console.log(`  created user @${username} (${u.role})`);
    }
    userIdToMongoId.set(u.id, existing._id.toString());
    userNameToMongoId.set(u.name, existing._id.toString());
  }
  console.log("Users migrated.");

  // 6. Audits
  const legacyAuditIdToMongoId = new Map<string, string>();
  const legacyAuditIdToNumber = new Map<string, string>();
  let auditsCreated = 0;
  for (const a of legacyAudits) {
    if (deletedAuditIds.has(a.id)) continue;
    const existing = await Audit.findOne({ auditNumber: a.number });
    if (existing) {
      legacyAuditIdToMongoId.set(a.id, existing._id.toString());
      legacyAuditIdToNumber.set(a.id, existing.auditNumber);
      continue;
    }

    const questionMeta = new Map(legacyQuestions.map((q) => [q.id, q]));
    const checklist = [];
    for (const [qid, resp] of Object.entries(a.responses || {}) as Array<[string, any]>) {
      const meta = questionMeta.get(qid);
      checklist.push({
        questionId: qid,
        category: meta?.cat || "SORT",
        question: meta?.text || qid,
        response: mapResponse(resp.st),
        observation: resp.obs,
        severity: resp.sev,
        beforePhotos: await photosToRefs(resp.photos, "legacy-audit-photos", `audit ${a.number} question ${qid}`)
      });
    }

    const categoryScores: Record<string, number> = {};
    for (const [cat, s] of Object.entries(a.catScores || {})) {
      categoryScores[cat] = (s as any).score;
    }

    const auditorId = userNameToMongoId.get(a.auditor) || userIdToMongoId.get(a.auditorId);
    const createdById = userNameToMongoId.get(a.createdBy) || auditorId;
    if (!createdById) {
      console.warn(`  skipping audit ${a.number}: no matching user for auditor/createdBy`);
      continue;
    }

    const created = await Audit.create({
      auditNumber: a.number,
      zone: a.zone,
      department: a.department,
      auditor: auditorId,
      auditorName: a.auditor,
      date: a.date ? new Date(a.date) : new Date(a.createdAt),
      status: "COMPLETED",
      checklist,
      categoryScores,
      totalScore: a.score || 0,
      createdBy: createdById,
      createdAt: a.createdAt ? new Date(a.createdAt) : undefined
    });
    legacyAuditIdToMongoId.set(a.id, created._id.toString());
    legacyAuditIdToNumber.set(a.id, created.auditNumber);
    auditsCreated += 1;
  }
  console.log(`Audits migrated: ${auditsCreated} created.`);

  // 7. Findings
  let findingsCreated = 0;
  const findingCounterByAudit = new Map<string, number>();
  for (const f of legacyFindings) {
    if (deletedFindingIds.has(f.id)) continue;
    const auditMongoId = legacyAuditIdToMongoId.get(f.auditId);
    const auditNumber = legacyAuditIdToNumber.get(f.auditId) || f.auditNumber;
    if (!auditNumber) continue;

    const seq = (findingCounterByAudit.get(auditNumber) || 0) + 1;
    findingCounterByAudit.set(auditNumber, seq);
    const findingNumber = `${auditNumber}-F${String(seq).padStart(2, "0")}`;

    const existing = await Finding.findOne({ findingNumber });
    if (existing) continue;

    const status = mapFindingStatus(f.status);
    const timeline = (toArray(f.timeline) as any[]).map((t) => ({
      action: t.action,
      note: t.note,
      by: userNameToMongoId.get(t.user),
      byName: t.user,
      at: t.date ? new Date(t.date) : new Date()
    }));

    const createdById = userNameToMongoId.get(f.createdBy);

    await Finding.create({
      findingNumber,
      auditId: auditMongoId,
      auditNumber,
      zone: f.zone,
      department: f.department,
      questionId: f.id,
      category: f.category,
      question: f.question,
      severity: f.severity || "Medium",
      observation: f.observation,
      beforePhotos: await photosToRefs(f.photos, "legacy-finding-before", `finding ${findingNumber} before`),
      assignedTo: f.assignedTo,
      dueDate: f.due ? new Date(f.due) : undefined,
      capaAction: f.correctiveAction,
      capaStatus: status === "CLOSED" ? "APPROVED" : "NOT_SUBMITTED",
      afterPhotos: await photosToRefs(f.afterPhotos, "legacy-finding-after", `finding ${findingNumber} after`),
      closureRemarks: f.closureComments || f.auditorRemarks,
      auditorReviewStatus: status === "CLOSED" ? "APPROVED" : "PENDING",
      timeline,
      status,
      createdBy: createdById,
      createdAt: f.createdDate ? new Date(f.createdDate) : undefined
    });
    findingsCreated += 1;
  }
  console.log(`Findings migrated: ${findingsCreated} created.`);

  await normalizeExistingPhotoRefs();
  await restoreMissingLegacyMedia({
    legacyAudits,
    legacyFindings,
    deletedAuditIds,
    deletedFindingIds,
    legacyAuditIdToNumber
  });

  console.log("Legacy data migration complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
