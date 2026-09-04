/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const mongoose = require("mongoose");

function normalized(value) {
  return String(value || "").trim().toLowerCase();
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
  const departmentNames = new Set(departments.map((department) => normalized(department.name)));
  let nonAdequateRows = 0;
  let missingFindingDocs = 0;
  let auditFindingLinkMismatches = 0;
  let storedScoreMismatches = 0;

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

    const categoryScores = new Map();
    for (const item of audit.checklist || []) {
      if (item.response === "N/A") continue;
      const score = categoryScores.get(item.category) || { adequate: 0, total: 0 };
      score.total += 1;
      if (item.response === "Adequate") score.adequate += 1;
      categoryScores.set(item.category, score);
    }
    const scoredCategories = [...categoryScores.values()];
    const expectedScore = scoredCategories.length
      ? Math.round(scoredCategories.reduce((sum, score) =>
          sum + Math.round((score.adequate / score.total) * 100), 0
        ) / scoredCategories.length)
      : 0;
    if (Number(audit.totalScore) !== expectedScore) storedScoreMismatches += 1;
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
    storedScoreMismatches,
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
    "storedScoreMismatches",
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
