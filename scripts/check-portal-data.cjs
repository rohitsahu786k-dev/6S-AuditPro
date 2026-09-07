/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const mongoose = require("mongoose");

function normalized(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function countBy(items, field) {
  const counts = new Map();
  for (const item of items) {
    const value = String(item[field] || "Unknown");
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries(counts);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const [audits, findings, departments, zones, people, questions, users] = await Promise.all([
    db.collection("audits").find({}).toArray(),
    db.collection("findings").find({}).toArray(),
    db.collection("departments").find({}).toArray(),
    db.collection("zones").find({}).toArray(),
    db.collection("people").find({}).toArray(),
    db.collection("questions").find({}).toArray(),
    db.collection("users").find({}, { projection: { role: 1, status: 1, department: 1 } }).toArray()
  ]);

  const findingsById = new Map(findings.map((finding) => [String(finding._id), finding]));
  const auditsById = new Map(audits.map((audit) => [String(audit._id), audit]));
  const sourceDepartmentByAuditId = new Map(audits.map((audit) => [String(audit._id), normalized(audit.department)]));
  const sourceDepartmentByAuditNumber = new Map(audits.map((audit) => [audit.auditNumber, normalized(audit.department)]));
  const departmentNames = new Set(departments.map((department) => normalized(department.name)));
  let nonAdequateRows = 0;
  let missingFindingDocs = 0;
  let auditFindingLinkMismatches = 0;
  let legacyTotalScoreMismatches = 0;

  function isSameChecklistFinding(item, finding) {
    return (item.questionId && finding.questionId && normalized(item.questionId) === normalized(finding.questionId)) ||
      (normalized(item.category) === normalized(finding.category) && normalized(item.question) === normalized(finding.question));
  }

  function linkedToAudit(finding, audit) {
    const findingIdSet = new Set((audit.findingIds || []).map(String));
    return String(finding.auditId || "") === String(audit._id) ||
      finding.auditNumber === audit.auditNumber ||
      findingIdSet.has(String(finding._id));
  }

  function canonicalScoreFor(audit, auditFindings) {
    const auditDepartment = normalized(audit.department);
    const linkedFindings = auditFindings.filter((finding) => linkedToAudit(finding, audit));
    const countedFindingIds = new Set();
    let adequate = 0;
    let ownedNotAdequate = 0;

    for (const item of audit.checklist || []) {
      if (item.response === "Adequate") {
        adequate += 1;
      } else if (item.response === "Not Adequate") {
        const finding = linkedFindings.find((candidate) => isSameChecklistFinding(item, candidate));
        const ownerDepartment = normalized(finding?.department || item.actionOwnerDepartment || audit.department);
        if (finding?._id) countedFindingIds.add(String(finding._id));
        if (ownerDepartment === auditDepartment) ownedNotAdequate += 1;
      }
    }

    for (const finding of linkedFindings) {
      const id = String(finding._id || "");
      if (!id || countedFindingIds.has(id)) continue;
      if (normalized(finding.department) !== auditDepartment) continue;
      ownedNotAdequate += 1;
      countedFindingIds.add(id);
    }

    for (const finding of auditFindings) {
      if (linkedToAudit(finding, audit)) continue;
      if (normalized(finding.department) !== auditDepartment) continue;
      const sourceDepartment = sourceDepartmentByAuditId.get(String(finding.auditId || "")) ||
        sourceDepartmentByAuditNumber.get(finding.auditNumber);
      if (!sourceDepartment || sourceDepartment === auditDepartment) continue;
      const id = String(finding._id || "");
      if (id && countedFindingIds.has(id)) continue;
      ownedNotAdequate += 1;
      if (id) countedFindingIds.add(id);
    }

    const applicable = adequate + ownedNotAdequate;
    return applicable ? Math.round((adequate / applicable) * 100) : 0;
  }

  for (const audit of audits) {
    const auditFindings = findings.filter((finding) =>
      String(finding.auditId || "") === String(audit._id) || finding.auditNumber === audit.auditNumber
    );

    for (const item of audit.checklist || []) {
      if (item.response !== "Not Adequate") continue;
      nonAdequateRows += 1;
      const match = auditFindings.some((finding) =>
        (item.questionId && finding.questionId && String(item.questionId) === String(finding.questionId)) ||
        (normalized(item.category) === normalized(finding.category) && normalized(item.question) === normalized(finding.question))
      );
      if (!match) missingFindingDocs += 1;
    }

    for (const findingId of audit.findingIds || []) {
      const finding = findingsById.get(String(findingId));
      const linked = finding && (
        String(finding.auditId || "") === String(audit._id) || finding.auditNumber === audit.auditNumber
      );
      if (!linked) auditFindingLinkMismatches += 1;
    }

    if (Number(audit.totalScore) !== canonicalScoreFor(audit, findings)) legacyTotalScoreMismatches += 1;
  }

  const numberCounts = countBy(findings, "findingNumber");
  const duplicateFindingNumbers = Object.values(numberCounts).filter((count) => count > 1).length;
  const orphanFindings = findings.filter((finding) => finding.auditId && !auditsById.has(String(finding.auditId))).length;
  const orphanZones = zones.filter((zone) => !departmentNames.has(normalized(zone.department))).length;
  const orphanPeople = people.filter((person) =>
    person.department && normalized(person.department) !== "all" && !departmentNames.has(normalized(person.department))
  ).length;
  const orphanUsers = users.filter((user) =>
    user.department && normalized(user.department) !== "all" && !departmentNames.has(normalized(user.department))
  ).length;
  const invalidDates = findings.filter((finding) => finding.dueDate && Number.isNaN(new Date(finding.dueDate).getTime())).length +
    audits.filter((audit) =>
      (audit.startDate && Number.isNaN(new Date(audit.startDate).getTime())) ||
      (audit.endDate && Number.isNaN(new Date(audit.endDate).getTime()))
    ).length;
  const submittedMarkedOverdue = findings.filter((finding) =>
    finding.status === "OVERDUE" &&
    finding.capaStatus === "SUBMITTED"
  ).length;
  const mediaIds = new Set();

  for (const finding of findings) {
    for (const photo of [...(finding.beforePhotos || []), ...(finding.afterPhotos || [])]) {
      if (photo.publicId) mediaIds.add(photo.publicId);
    }
  }
  for (const audit of audits) {
    for (const item of audit.checklist || []) {
      for (const photo of item.beforePhotos || []) {
        if (photo.publicId) mediaIds.add(photo.publicId);
      }
    }
  }

  const consistency = {
    nonAdequateRows,
    missingFindingDocs,
    auditFindingLinkMismatches,
    orphanFindings,
    duplicateFindingNumbers,
    legacyTotalScoreMismatches,
    orphanZones,
    orphanPeople,
    orphanUsers,
    invalidDates,
    submittedMarkedOverdue
  };

  console.log(JSON.stringify({
    counts: {
      audits: audits.length,
      findings: findings.length,
      departments: departments.length,
      zones: zones.length,
      people: people.length,
      questions: questions.length,
      users: users.length,
      uniqueMedia: mediaIds.size
    },
    consistency,
    statuses: countBy(findings, "status"),
    severities: countBy(findings, "severity")
  }, null, 2));

  const blockingKeys = [
    "missingFindingDocs",
    "auditFindingLinkMismatches",
    "orphanFindings",
    "duplicateFindingNumbers",
    "invalidDates",
    "submittedMarkedOverdue"
  ];
  if (blockingKeys.some((key) => consistency[key] > 0)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
