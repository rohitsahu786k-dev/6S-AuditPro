import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Finding from "@/models/Finding";
import Audit from "@/models/Audit";
import { configureCloudinary } from "@/lib/cloudinary";

/**
 * Photos captured before the Cloudinary upload path existed were stored inline as
 * base64 data URIs. That made list queries transfer tens of megabytes. This uploads
 * each one to Cloudinary and replaces it with the hosted URL.
 *
 * Re-running is safe: photos that already point at a URL are skipped, and a photo is
 * only rewritten after its upload succeeds, so a failed run loses nothing.
 *
 *   npx tsx scripts/migrate-photos-to-cloudinary.ts --dry-run
 *   npx tsx scripts/migrate-photos-to-cloudinary.ts --limit=5
 *   npx tsx scripts/migrate-photos-to-cloudinary.ts
 */

const DATA_URI = /^data:([^;]+);base64,([\s\S]*)$/;
const UPLOAD_CONCURRENCY = 5;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? Number.POSITIVE_INFINITY);
const backupDir = args.find((arg) => arg.startsWith("--backup-dir="))?.split("=")[1]
  ?? path.resolve(process.cwd(), "..", "6S-audit-backups");

type Photo = { secureUrl?: string; publicId?: string; sizeBytes?: number; [key: string]: unknown };

const stats = { scanned: 0, uploaded: 0, skipped: 0, failed: 0 };

function isInlinePhoto(photo: Photo | null | undefined) {
  return DATA_URI.test(String(photo?.secureUrl || ""));
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function uploadBuffer(cloudinary: ReturnType<typeof configureCloudinary>, buffer: Buffer, folder: string) {
  return new Promise<{ secure_url: string; public_id: string; bytes: number }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
      if (error || !result) reject(error || new Error("Cloudinary returned no result"));
      else resolve(result as { secure_url: string; public_id: string; bytes: number });
    });
    stream.end(buffer);
  });
}

/** Returns the photo unchanged when it is already hosted or when its upload fails. */
async function migratePhoto(
  cloudinary: ReturnType<typeof configureCloudinary>,
  photo: Photo,
  folderSuffix: string,
  label: string
): Promise<Photo> {
  const match = DATA_URI.exec(String(photo?.secureUrl || ""));
  if (!match) {
    stats.skipped += 1;
    return photo;
  }

  stats.scanned += 1;
  if (dryRun) return photo;

  const buffer = Buffer.from(match[2], "base64");
  const folder = `${process.env.CLOUDINARY_UPLOAD_FOLDER || "onepws-6s-auditpro"}/${folderSuffix}`;
  try {
    const result = await uploadBuffer(cloudinary, buffer, folder);
    stats.uploaded += 1;
    process.stdout.write(`  uploaded ${stats.uploaded}/${stats.scanned} (${label})\r`);
    return { ...photo, secureUrl: result.secure_url, publicId: result.public_id, sizeBytes: result.bytes };
  } catch (error) {
    stats.failed += 1;
    console.error(`\n  FAILED ${label}: ${(error as Error).message}`);
    return photo;
  }
}

async function backup() {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `photo-migration-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const [findings, audits] = await Promise.all([
    Finding.find({ $or: [{ "beforePhotos.0": { $exists: true } }, { "afterPhotos.0": { $exists: true } }] })
      .select("beforePhotos afterPhotos").lean(),
    Audit.find({ "checklist.beforePhotos.0": { $exists: true } })
      .select("checklist.questionId checklist.beforePhotos").lean()
  ]);
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), findings, audits }, null, 2));
  const sizeMb = (fs.statSync(file).size / 1048576).toFixed(1);
  console.log(`Backup: ${file} (${sizeMb} MB, ${findings.length} findings, ${audits.length} audits)\n`);
}

async function migrateFindings(cloudinary: ReturnType<typeof configureCloudinary>) {
  const findings = await Finding.find({
    $or: [{ "beforePhotos.0": { $exists: true } }, { "afterPhotos.0": { $exists: true } }]
  }).select("findingNumber beforePhotos afterPhotos").lean();

  let touched = 0;
  for (const finding of findings) {
    if (touched >= limit) break;
    const before = (finding.beforePhotos || []) as unknown as Photo[];
    const after = (finding.afterPhotos || []) as unknown as Photo[];
    if (!before.some(isInlinePhoto) && !after.some(isInlinePhoto)) continue;

    const label = finding.findingNumber || String(finding._id);
    const newBefore = await mapWithConcurrency(before, (photo) => migratePhoto(cloudinary, photo, "finding-before", label));
    const newAfter = await mapWithConcurrency(after, (photo) => migratePhoto(cloudinary, photo, "finding-after", label));

    if (!dryRun) {
      await Finding.updateOne({ _id: finding._id }, { $set: { beforePhotos: newBefore, afterPhotos: newAfter } });
    }
    touched += 1;
  }
  console.log(`\nFindings: ${touched} documents processed`);
}

async function migrateAudits(cloudinary: ReturnType<typeof configureCloudinary>) {
  const audits = await Audit.find({ "checklist.beforePhotos.0": { $exists: true } })
    .select("auditNumber checklist.beforePhotos").lean();

  let touched = 0;
  for (const audit of audits) {
    if (touched >= limit) break;
    const checklist = (audit.checklist || []) as unknown as Array<{ beforePhotos?: Photo[] }>;
    if (!checklist.some((item) => (item.beforePhotos || []).some(isInlinePhoto))) continue;

    const label = audit.auditNumber || String(audit._id);
    // Written back per index so nothing else in the checklist row is disturbed.
    const updates: Record<string, Photo[]> = {};
    for (let index = 0; index < checklist.length; index += 1) {
      const photos = (checklist[index].beforePhotos || []) as Photo[];
      if (!photos.some(isInlinePhoto)) continue;
      updates[`checklist.${index}.beforePhotos`] = await mapWithConcurrency(
        photos,
        (photo) => migratePhoto(cloudinary, photo, "audit-before", label)
      );
    }

    if (!dryRun && Object.keys(updates).length > 0) {
      await Audit.updateOne({ _id: audit._id }, { $set: updates });
    }
    touched += 1;
  }
  console.log(`\nAudits: ${touched} documents processed`);
}

async function main() {
  const cloudinary = configureCloudinary();
  await connectDB();

  if (dryRun) console.log("DRY RUN - nothing will be uploaded or written\n");
  else await backup();

  await migrateFindings(cloudinary);
  await migrateAudits(cloudinary);

  console.log("\n--- summary ---");
  console.log(`inline photos found : ${stats.scanned}`);
  console.log(`uploaded            : ${stats.uploaded}`);
  console.log(`already hosted      : ${stats.skipped}`);
  console.log(`failed              : ${stats.failed}`);
  if (stats.failed > 0) console.log("\nFailed photos kept their original data. Re-run to retry them.");

  await mongoose.disconnect();
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch { /* already closed */ }
  process.exit(1);
});
