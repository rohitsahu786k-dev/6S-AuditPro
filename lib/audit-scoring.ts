import { CATEGORIES } from "@/lib/constants";
import { canonicalDepartmentName } from "@/lib/org-utils";

export type ChecklistResponse = {
  questionId?: unknown;
  category: string;
  question?: string;
  response: "Adequate" | "Not Adequate" | "N/A";
  actionOwnerDepartment?: string;
};

export type AuditScoreFinding = {
  _id?: unknown;
  auditId?: unknown;
  auditNumber?: string | null;
  department?: string | null;
  questionId?: unknown;
  category?: string | null;
  question?: string | null;
};

export type AuditScoreAudit = {
  _id?: unknown;
  auditNumber?: string | null;
  department: string;
  checklist?: ChecklistResponse[];
  findingIds?: unknown[];
};

export type DepartmentAuditCategoryScore = {
  adequate: number;
  ownedNotAdequate: number;
  total: number;
  na: number;
  score: number;
};

export type DepartmentAuditScore = {
  adequateCount: number;
  ownedNotAdequateCount: number;
  applicableCount: number;
  naCount: number;
  score: number;
  categoryScores: Record<string, DepartmentAuditCategoryScore>;
};

type DepartmentLookup = {
  configuredDepartments?: string[];
  sourceDepartmentByAuditId?: Map<string, string>;
  sourceDepartmentByAuditNumber?: Map<string, string>;
};

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sameText(left: unknown, right: unknown) {
  return normalizeText(left) === normalizeText(right);
}

function roundedPercent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function canonicalOwner(value: string | null | undefined, configuredDepartments: string[] = []) {
  return canonicalDepartmentName(value || "", configuredDepartments);
}

function ensureCategory(
  categoryScores: Record<string, DepartmentAuditCategoryScore>,
  category: string
) {
  if (!categoryScores[category]) {
    categoryScores[category] = { adequate: 0, ownedNotAdequate: 0, total: 0, na: 0, score: 0 };
  }
  return categoryScores[category];
}

function isLinkedToAudit(finding: AuditScoreFinding, audit: AuditScoreAudit) {
  const findingIdSet = new Set((audit.findingIds || []).map(String));
  return Boolean(
    (audit._id && finding.auditId && String(finding.auditId) === String(audit._id)) ||
    (audit.auditNumber && finding.auditNumber && finding.auditNumber === audit.auditNumber) ||
    (finding._id && findingIdSet.has(String(finding._id)))
  );
}

function matchesChecklistItem(item: ChecklistResponse, finding: AuditScoreFinding) {
  if (item.questionId && finding.questionId && sameText(item.questionId, finding.questionId)) return true;
  return sameText(item.category, finding.category) && sameText(item.question, finding.question);
}

function findingSourceDepartment(finding: AuditScoreFinding, lookup: DepartmentLookup) {
  return (
    (finding.auditId ? lookup.sourceDepartmentByAuditId?.get(String(finding.auditId)) : undefined) ||
    (finding.auditNumber ? lookup.sourceDepartmentByAuditNumber?.get(finding.auditNumber) : undefined)
  );
}

export function calculateDepartmentAuditScore(input: {
  audit: AuditScoreAudit;
  department?: string;
  findings?: AuditScoreFinding[];
  includeTransferredIn?: boolean;
} & DepartmentLookup): DepartmentAuditScore {
  const configuredDepartments = input.configuredDepartments || [];
  const audit = input.audit;
  const scoringDepartment = canonicalOwner(input.department || audit.department, configuredDepartments);
  const findings = input.findings || [];
  const categoryScores: Record<string, DepartmentAuditCategoryScore> = {};
  for (const category of CATEGORIES) ensureCategory(categoryScores, category);

  const linkedFindings = findings.filter((finding) => isLinkedToAudit(finding, audit));
  const countedFindingIds = new Set<string>();
  let adequateCount = 0;
  let ownedNotAdequateCount = 0;
  let naCount = 0;

  for (const item of audit.checklist || []) {
    const category = item.category || "Uncategorized";
    const bucket = ensureCategory(categoryScores, category);
    if (item.response === "Adequate") {
      adequateCount += 1;
      bucket.adequate += 1;
    } else if (item.response === "N/A") {
      naCount += 1;
      bucket.na += 1;
    } else if (item.response === "Not Adequate") {
      const finding = linkedFindings.find((candidate) => matchesChecklistItem(item, candidate));
      const ownerDepartment = canonicalOwner(
        finding?.department || item.actionOwnerDepartment || audit.department,
        configuredDepartments
      );
      if (finding?._id) countedFindingIds.add(String(finding._id));
      if (ownerDepartment === scoringDepartment) {
        ownedNotAdequateCount += 1;
        bucket.ownedNotAdequate += 1;
      }
    }
  }

  for (const finding of linkedFindings) {
    const id = String(finding._id || "");
    if (!id || countedFindingIds.has(id)) continue;
    const ownerDepartment = canonicalOwner(finding.department || audit.department, configuredDepartments);
    if (ownerDepartment !== scoringDepartment) continue;
    const category = finding.category || "Uncategorized";
    const bucket = ensureCategory(categoryScores, category);
    ownedNotAdequateCount += 1;
    bucket.ownedNotAdequate += 1;
    countedFindingIds.add(id);
  }

  if (input.includeTransferredIn !== false) {
    for (const finding of findings) {
      if (isLinkedToAudit(finding, audit)) continue;
      const ownerDepartment = canonicalOwner(finding.department || "", configuredDepartments);
      if (ownerDepartment !== scoringDepartment) continue;
      const sourceDepartment = canonicalOwner(findingSourceDepartment(finding, input), configuredDepartments);
      if (!sourceDepartment || sourceDepartment === scoringDepartment) continue;
      const id = String(finding._id || "");
      if (id && countedFindingIds.has(id)) continue;
      const category = finding.category || "Uncategorized";
      const bucket = ensureCategory(categoryScores, category);
      ownedNotAdequateCount += 1;
      bucket.ownedNotAdequate += 1;
      if (id) countedFindingIds.add(id);
    }
  }

  for (const bucket of Object.values(categoryScores)) {
    bucket.total = bucket.adequate + bucket.ownedNotAdequate;
    bucket.score = roundedPercent(bucket.adequate, bucket.total);
  }

  const applicableCount = adequateCount + ownedNotAdequateCount;
  return {
    adequateCount,
    ownedNotAdequateCount,
    applicableCount,
    naCount,
    score: roundedPercent(adequateCount, applicableCount),
    categoryScores
  };
}

export function scoreChecklist(items: ChecklistResponse[]) {
  const categoryScores: Record<string, DepartmentAuditCategoryScore> = {};
  for (const category of CATEGORIES) ensureCategory(categoryScores, category);
  let adequate = 0;
  let notAdequate = 0;

  for (const item of items) {
    const bucket = ensureCategory(categoryScores, item.category || "Uncategorized");
    if (item.response === "Adequate") {
      adequate += 1;
      bucket.adequate += 1;
    } else if (item.response === "Not Adequate") {
      notAdequate += 1;
      bucket.ownedNotAdequate += 1;
    } else if (item.response === "N/A") {
      bucket.na += 1;
    }
  }

  for (const bucket of Object.values(categoryScores)) {
    bucket.total = bucket.adequate + bucket.ownedNotAdequate;
    bucket.score = roundedPercent(bucket.adequate, bucket.total);
  }

  return { categoryScores, totalScore: roundedPercent(adequate, adequate + notAdequate) };
}

/**
 * A department's score for an audit. Non-conformities that another department owns
 * are left out, so a department is not marked down for issues it was not asked to
 * fix. Computed from the checklist rather than the stored totalScore, which holds
 * the raw all-items score on some audits and this filtered score on others.
 */
export function departmentAuditScore(
  items: Array<ChecklistResponse & { actionOwnerDepartment?: string }>,
  department: string
) {
  return calculateDepartmentAuditScore({
    audit: { department, checklist: items },
    department,
    includeTransferredIn: false
  }).score;
}

export function scoreLabel(score: number) {
  if (score <= 30) return { label: "1S", desc: "Sort Only" };
  if (score <= 50) return { label: "2S", desc: "Set in Order" };
  if (score <= 70) return { label: "3S", desc: "Shine" };
  if (score <= 80) return { label: "4S", desc: "Standardize" };
  if (score <= 90) return { label: "5S", desc: "Sustain" };
  return { label: "6S", desc: "Safety + Sustain" };
}

export function addWorkingDays(start: Date, days: number) {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

export function defaultSeverity(response: string, category: string) {
  if (response !== "Not Adequate") return undefined;
  const normalizedCategory = category.toUpperCase();
  if (normalizedCategory.includes("SAFETY")) return "Critical";
  if (normalizedCategory.includes("ENVIRONMENT")) return "High";
  return "Medium";
}
