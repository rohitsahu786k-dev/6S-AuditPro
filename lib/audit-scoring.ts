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
  auditType?: "STANDARD" | "ADHOC" | string | null;
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

export type MergeableAudit = {
  department?: string | null;
  date?: string | Date | null;
  startDate?: string | Date | null;
  totalScore?: number | null;
  adequateCount?: number | null;
  applicableCount?: number | null;
};

export type MergedAuditScore = {
  adequateCount: number;
  applicableCount: number;
  auditCount: number;
  score: number;
};

export type MergedAuditGroup = MergedAuditScore & { department: string; monthKey: string };

export type DepartmentScoreEntry = {
  department: string;
  totalScore: number;
  adequateCount: number;
  applicableCount: number;
  ownedNotAdequateCount: number;
  naCount: number;
  categoryScores: Record<string, DepartmentAuditCategoryScore>;
};

function scoreEntry(department: string, score: DepartmentAuditScore): DepartmentScoreEntry {
  return {
    department,
    totalScore: score.score,
    adequateCount: score.adequateCount,
    applicableCount: score.applicableCount,
    ownedNotAdequateCount: score.ownedNotAdequateCount,
    naCount: score.naCount,
    categoryScores: score.categoryScores
  };
}

export function departmentScoreEntriesForAudit(input: {
  audit: AuditScoreAudit;
  findings?: AuditScoreFinding[];
  includeTransferredIn?: boolean;
} & DepartmentLookup): DepartmentScoreEntry[] {
  const configuredDepartments = input.configuredDepartments || [];
  const auditDepartment = canonicalOwner(input.audit.department, configuredDepartments);

  if (input.audit.auditType === "ADHOC") {
    const departments = uniqueDepartments(
      (input.audit.checklist || []).map((item) => canonicalOwner(item.actionOwnerDepartment || auditDepartment, configuredDepartments))
    );

    return departments
      .map((department) => {
        const checklist = (input.audit.checklist || []).filter((item) =>
          canonicalOwner(item.actionOwnerDepartment || auditDepartment, configuredDepartments) === department
        );
        return scoreEntry(department, calculateDepartmentAuditScore({
          ...input,
          audit: { ...input.audit, department, checklist },
          department,
          includeTransferredIn: false
        }));
      })
      .filter((entry) => entry.applicableCount > 0);
  }

  return [
    scoreEntry(auditDepartment, calculateDepartmentAuditScore({
      ...input,
      audit: { ...input.audit, department: auditDepartment },
      department: auditDepartment
    }))
  ];
}

function uniqueDepartments(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function auditPeriodDate(audit: MergeableAudit) {
  return audit.startDate || audit.date || null;
}

export function auditMonthKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function departmentMonthKey(department: string, monthKey: string) {
  return `${department} ${monthKey}`;
}

/**
 * Standard and Adhoc audits of the same department in the same month describe one
 * assessment of that area, so their checklist items are pooled into a single score
 * instead of averaging each audit's percentage - averaging would give a two-item
 * adhoc sheet the same weight as a full checklist.
 */
export function mergeAuditScores(audits: MergeableAudit[]): MergedAuditScore | null {
  if (audits.length === 0) return null;
  let adequateCount = 0;
  let applicableCount = 0;

  for (const audit of audits) {
    const adequate = Number(audit.adequateCount);
    const applicable = Number(audit.applicableCount);
    // An audit with counts but nothing applicable to this department (every item N/A
    // or owned elsewhere) adds nothing rather than pulling the month down to 0%.
    if (Number.isFinite(adequate) && Number.isFinite(applicable)) {
      adequateCount += adequate;
      applicableCount += applicable;
      continue;
    }
    const totalScore = Number(audit.totalScore);
    // Records without stored counts contribute their percentage with equal weight.
    if (Number.isFinite(totalScore)) {
      adequateCount += totalScore;
      applicableCount += 100;
    }
  }

  if (applicableCount === 0) return null;

  return {
    adequateCount,
    applicableCount,
    auditCount: audits.length,
    score: roundedPercent(adequateCount, applicableCount)
  };
}

export function mergeAuditScoresByDepartmentMonth<T extends MergeableAudit>(audits: T[]) {
  const buckets = new Map<string, { department: string; monthKey: string; audits: T[] }>();

  for (const audit of audits) {
    const department = String(audit.department || "").trim();
    const monthKey = auditMonthKey(auditPeriodDate(audit));
    if (!department || !monthKey) continue;
    const key = departmentMonthKey(department, monthKey);
    const bucket = buckets.get(key);
    if (bucket) bucket.audits.push(audit);
    else buckets.set(key, { department, monthKey, audits: [audit] });
  }

  const merged = new Map<string, MergedAuditGroup>();
  for (const [key, bucket] of buckets) {
    const score = mergeAuditScores(bucket.audits);
    if (score) merged.set(key, { ...score, department: bucket.department, monthKey: bucket.monthKey });
  }
  return merged;
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
