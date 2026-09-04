/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
/**
 * Repairs the data damage caused by the finding reconciler's question-id matcher.
 *
 * Older findings stored a generated question id while the audit checklist kept the
 * master question id, so the reconciler treated every historical finding as missing
 * and raised a duplicate copy of it. The duplicates are dated by the reconciler run
 * rather than by their audit, which also skewed the monthly reporting.
 *
 * Runs read-only by default. Pass --apply to write, which first saves every document
 * it deletes to a timestamped JSON backup next to this script's working directory.
 *
 *   node -r dotenv/config scripts/repair-portal-data.cjs
 *   node -r dotenv/config scripts/repair-portal-data.cjs --apply
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const RESTORED_ACTION = "Finding restored from audit checklist";

function normalized(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function auditDateOf(audit) {
  return new Date(audit.startDate || audit.date || audit.createdAt);
}

/** A duplicate is only safe to drop while it holds no work of its own. */
function isDisposable(finding) {
  return (finding.capaStatus === "NOT_SUBMITTED" || !finding.capaStatus) &&
    !finding.capaAction &&
    !finding.closureRemarks &&
    (finding.afterPhotos || []).length === 0 &&
    ["OPEN", "OVERDUE"].includes(finding.status);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const auditsCol = db.collection("audits");
  const findingsCol = db.collection("findings");

  const audits = await auditsCol.find({}).project({ "checklist.beforePhotos": 0 }).toArray();
  const findings = await findingsCol.find({}).toArray();
  const report = { auditStartDates: 0, duplicatesRemoved: 0, duplicatesSkipped: [], stuckCapaFixed: 0, restoredDatesFixed: 0 };

  // 1. Audits carry only the legacy `date`; every view reads `startDate` first.
  const auditsMissingStart = audits.filter((audit) => !audit.startDate && audit.date);
  report.auditStartDates = auditsMissingStart.length;
  if (APPLY) {
    for (const audit of auditsMissingStart) {
      await auditsCol.updateOne({ _id: audit._id }, { $set: { startDate: audit.date } });
    }
  }

  // 2. Duplicate findings: same audit, same question, one of them reconciler-raised.
  const doomed = [];
  for (const audit of audits) {
    const auditFindings = findings.filter((finding) =>
      String(finding.auditId || "") === String(audit._id) || finding.auditNumber === audit.auditNumber
    );

    const byQuestion = new Map();
    for (const finding of auditFindings) {
      const key = normalized(finding.question);
      if (!byQuestion.has(key)) byQuestion.set(key, []);
      byQuestion.get(key).push(finding);
    }

    for (const [question, group] of byQuestion) {
      if (group.length < 2) continue;
      const restored = group.filter((finding) => finding.timeline?.[0]?.action === RESTORED_ACTION);
      const originals = group.filter((finding) => finding.timeline?.[0]?.action !== RESTORED_ACTION);

      // Only the unambiguous case is touched: exactly one original kept, its
      // reconciler-raised copies dropped. Anything else is reported, not deleted.
      if (originals.length !== 1 || restored.length !== group.length - 1) {
        report.duplicatesSkipped.push({
          audit: audit.auditNumber,
          question: question.slice(0, 60),
          reason: "ambiguous group",
          findings: group.map((finding) => `${finding.findingNumber}/${finding.status}`)
        });
        continue;
      }

      for (const duplicate of restored) {
        if (!isDisposable(duplicate)) {
          report.duplicatesSkipped.push({
            audit: audit.auditNumber,
            question: question.slice(0, 60),
            reason: "duplicate holds CAPA work",
            findings: [`${duplicate.findingNumber}/${duplicate.status}/${duplicate.capaStatus}`]
          });
          continue;
        }
        doomed.push({ auditId: audit._id, finding: duplicate, keeps: originals[0].findingNumber });
      }
    }
  }
  report.duplicatesRemoved = doomed.length;

  if (APPLY && doomed.length > 0) {
    const backupPath = path.resolve(`removed-duplicate-findings-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(doomed.map((entry) => entry.finding), null, 2));
    console.error(`Backup of removed findings written to ${backupPath}`);

    for (const entry of doomed) {
      await findingsCol.deleteOne({ _id: entry.finding._id });
      await auditsCol.updateOne({ _id: entry.auditId }, { $pull: { findingIds: entry.finding._id } });
    }
  }

  const removedIds = new Set(doomed.map((entry) => String(entry.finding._id)));

  // 3. An older overdue sweep also swallowed SUBMITTED findings, so CAPAs awaiting
  //    review are sitting in OVERDUE and never reach the auditor's review queue.
  const stuckCapa = findings.filter((finding) =>
    !removedIds.has(String(finding._id)) &&
    finding.status === "OVERDUE" &&
    finding.capaStatus === "SUBMITTED" &&
    finding.auditorReviewStatus === "PENDING"
  );
  report.stuckCapaFixed = stuckCapa.length;
  if (APPLY) {
    for (const finding of stuckCapa) {
      await findingsCol.updateOne({ _id: finding._id }, { $set: { status: "SUBMITTED" } });
    }
  }

  // 4. Surviving reconciler-raised findings are stamped with the run date. Monthly
  //    reporting and the findings date filter both read createdAt, so date them by
  //    their audit instead.
  const auditsById = new Map(audits.map((audit) => [String(audit._id), audit]));
  const auditsByNumber = new Map(audits.map((audit) => [audit.auditNumber, audit]));
  const misdated = [];
  for (const finding of findings) {
    if (removedIds.has(String(finding._id))) continue;
    if (finding.timeline?.[0]?.action !== RESTORED_ACTION) continue;
    const audit = auditsById.get(String(finding.auditId || "")) || auditsByNumber.get(finding.auditNumber);
    if (!audit) continue;
    const auditDate = auditDateOf(audit);
    if (Number.isNaN(auditDate.getTime())) continue;
    if (Math.abs(new Date(finding.createdAt).getTime() - auditDate.getTime()) < 24 * 60 * 60 * 1000) continue;
    misdated.push({ finding, auditDate });
  }
  report.restoredDatesFixed = misdated.length;
  if (APPLY) {
    for (const entry of misdated) {
      await findingsCol.updateOne({ _id: entry.finding._id }, { $set: { createdAt: entry.auditDate } });
    }
  }

  console.log(JSON.stringify({ mode: APPLY ? "APPLIED" : "DRY RUN", ...report }, null, 2));
  if (!APPLY) console.error("\nDry run only. Re-run with --apply to write these changes.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
