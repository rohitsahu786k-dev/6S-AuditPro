import { requireUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Finding from "@/models/Finding";
import Audit from "@/models/Audit";
import { deleteImage } from "@/services/upload.service";
import { fail, ok } from "@/utils/api";

export async function GET() {
  try {
    const user = await requireUser("findings:read");
    await connectDB();

    const scope = user.role === "SPOC" && user.department ? { department: user.department } : {};

    // 1. Fetch Findings and Audits with media files (department-scoped for SPOC roles)
    const findings = await Finding.find({
      ...scope,
      $or: [
        { "beforePhotos.0": { $exists: true } },
        { "afterPhotos.0": { $exists: true } }
      ]
    }).lean();

    const audits = await Audit.find({
      ...scope,
      "checklist.beforePhotos.0": { $exists: true }
    }).lean();

    const allMedia: any[] = [];

    // 2. Parse Findings Before photos
    for (const f of findings) {
      if (f.beforePhotos && f.beforePhotos.length > 0) {
        for (const photo of f.beforePhotos) {
          allMedia.push({
            id: `${f._id}_before_${photo.publicId}`,
            url: photo.secureUrl,
            publicId: photo.publicId,
            type: "BEFORE",
            sourceId: f._id.toString(),
            sourceNumber: f.findingNumber,
            category: f.category,
            zone: f.zone,
            department: f.department,
            date: f.createdAt ? new Date(f.createdAt).toISOString() : new Date().toISOString(),
            description: f.question,
            severity: f.severity || "Medium",
            assignedTo: f.assignedTo || ""
          });
        }
      }

      // Parse Findings After photos
      if (f.afterPhotos && f.afterPhotos.length > 0) {
        for (const photo of f.afterPhotos) {
          allMedia.push({
            id: `${f._id}_after_${photo.publicId}`,
            url: photo.secureUrl,
            publicId: photo.publicId,
            type: "AFTER",
            sourceId: f._id.toString(),
            sourceNumber: f.findingNumber,
            category: f.category,
            zone: f.zone,
            department: f.department,
            date: f.updatedAt ? new Date(f.updatedAt).toISOString() : (f.createdAt ? new Date(f.createdAt).toISOString() : new Date().toISOString()),
            description: f.capaAction || "CAPA Resolution Image",
            severity: f.severity || "Medium",
            assignedTo: f.assignedTo || ""
          });
        }
      }
    }

    // 3. Parse Audits checklist photos
    for (const a of audits) {
      for (const item of a.checklist) {
        if (item.beforePhotos && item.beforePhotos.length > 0) {
          for (const photo of item.beforePhotos) {
            allMedia.push({
              id: `${a._id}_checklist_${photo.publicId}`,
              url: photo.secureUrl,
              publicId: photo.publicId,
              type: "AUDIT",
              sourceId: a._id.toString(),
              sourceNumber: a.auditNumber,
              category: item.category,
              zone: a.zone,
              department: a.department,
              date: a.date ? new Date(a.date).toISOString() : (a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString()),
              description: item.question,
              severity: item.severity || "Low",
              assignedTo: ""
            });
          }
        }
      }
    }

    // 4. De-duplicate media by publicId to avoid showing duplicates for audit vs finding
    const mediaMap = new Map<string, any>();
    for (const item of allMedia) {
      if (mediaMap.has(item.publicId)) {
        const existing = mediaMap.get(item.publicId);
        // Prefer findings sources over audit checklist sources as they have more detail
        if (item.sourceNumber.startsWith("FND") && !existing.sourceNumber.startsWith("FND")) {
          mediaMap.set(item.publicId, item);
        }
      } else {
        mediaMap.set(item.publicId, item);
      }
    }

    const uniqueMedia = Array.from(mediaMap.values());

    // Sort by date descending
    uniqueMedia.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return ok(uniqueMedia);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser("findings:update");
    
    // Check administrative role
    if (user.role !== "MASTER_ADMIN" && user.role !== "ADMIN") {
      throw Object.assign(new Error("Unauthorized. Only admins can delete media assets."), { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let publicId = searchParams.get("publicId");

    if (!publicId) {
      try {
        const body = await request.json();
        publicId = body.publicId;
      } catch {
        // no JSON body provided; publicId remains null and is handled below
      }
    }

    if (!publicId) {
      throw Object.assign(new Error("Missing publicId parameter"), { status: 400 });
    }

    await connectDB();

    // 1. Remove references in findings beforePhotos
    const findingBefore = await Finding.findOne({ "beforePhotos.publicId": publicId });
    if (findingBefore) {
      findingBefore.beforePhotos = findingBefore.beforePhotos.filter((p: any) => p.publicId !== publicId) as any;
      findingBefore.timeline.push({
        action: "Evidence photo deleted",
        note: `Deleted photo with public ID: ${publicId}`,
        by: user.id,
        byName: user.name,
        at: new Date()
      });
      await findingBefore.save();
    }

    // 2. Remove references in findings afterPhotos
    const findingAfter = await Finding.findOne({ "afterPhotos.publicId": publicId });
    if (findingAfter) {
      findingAfter.afterPhotos = findingAfter.afterPhotos.filter((p: any) => p.publicId !== publicId) as any;
      findingAfter.timeline.push({
        action: "CAPA photo deleted",
        note: `Deleted CAPA photo with public ID: ${publicId}`,
        by: user.id,
        byName: user.name,
        at: new Date()
      });
      await findingAfter.save();
    }

    // 3. Remove references in audits checklist beforePhotos
    const auditWithPhoto = await Audit.findOne({ "checklist.beforePhotos.publicId": publicId });
    if (auditWithPhoto) {
      for (const item of auditWithPhoto.checklist) {
        if (item.beforePhotos) {
          item.beforePhotos = item.beforePhotos.filter((p: any) => p.publicId !== publicId) as any;
        }
      }
      await auditWithPhoto.save();
    }

    // 4. Delete the photo from Cloudinary
    const deleted = await deleteImage(publicId);

    return ok({ 
      success: true, 
      message: "Media resource deleted successfully.", 
      deletedFromCloudinary: deleted 
    });
  } catch (error) {
    return fail(error);
  }
}
