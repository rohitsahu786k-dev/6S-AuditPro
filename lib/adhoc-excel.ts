import crypto from "crypto";
import * as XLSX from "xlsx";
import { CATEGORIES } from "@/lib/constants";
import { canonicalDepartmentName } from "@/lib/org-utils";

export const ADHOC_TEMPLATE_COLUMNS = [
  "Sr. No.",
  "6S Category",
  "Observation / Checkpoint",
  "Assessment",
  "Responsible Department",
  "Responsible Person",
  "Severity",
  "Target Date",
  "Remarks",
  "Before Upload"
] as const;

const REQUIRED_ADHOC_TEMPLATE_COLUMNS = ADHOC_TEMPLATE_COLUMNS.filter((column) => column !== "Before Upload");

export const ASSESSMENTS = ["Adequate", "Not Adequate", "N/A"] as const;
export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export const MAX_ADHOC_EXCEL_BYTES = 5 * 1024 * 1024;
export const MAX_ADHOC_ROWS = 1000;

export type Assessment = typeof ASSESSMENTS[number];
export type SeverityValue = typeof SEVERITIES[number];

export type AdhocUserLookup = {
  id: string;
  name: string;
  username?: string;
  email?: string;
  department?: string;
  status?: string;
};

export type AdhocPreviewRow = {
  rowNumber: number;
  srNo: string;
  category: string;
  observation: string;
  assessment: Assessment | "";
  responsibleDepartment: string;
  responsiblePerson: string;
  responsibleUserId?: string;
  severity: SeverityValue | "";
  targetDate?: string;
  remarks: string;
  beforePhotos: Array<{ secureUrl: string; publicId: string }>;
  validationStatus: "VALID" | "INVALID" | "WARNING";
  errors: string[];
  warnings: string[];
};

export type AdhocPreviewResult = {
  fileName: string;
  fileHash: string;
  importBatchId: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  adequateCount: number;
  notAdequateCount: number;
  naCount: number;
  invalidRows: number;
  scoreWarning?: string;
  rows: AdhocPreviewRow[];
};

type RawRow = Record<string, unknown>;

const CATEGORY_ALIASES: Record<string, string> = {
  "1S": "SORT",
  SORT: "SORT",
  SEIRI: "SORT",
  "2S": "SET IN ORDER",
  SET: "SET IN ORDER",
  "SET IN ORDER": "SET IN ORDER",
  SEITON: "SET IN ORDER",
  "3S": "SHINE",
  SHINE: "SHINE",
  SEISO: "SHINE",
  "4S": "STANDARDIZE",
  STANDARDISE: "STANDARDIZE",
  STANDARDIZE: "STANDARDIZE",
  SEIKETSU: "STANDARDIZE",
  "5S": "SUSTAIN",
  SUSTAIN: "SUSTAIN",
  SHITSUKE: "SUSTAIN",
  "6S": "SAFETY",
  SAFETY: "SAFETY",
  "7S": "ENVIRONMENT",
  ENVIRONMENT: "ENVIRONMENT"
};

const ASSESSMENT_ALIASES: Record<string, Assessment> = {
  ADEQUATE: "Adequate",
  OK: "Adequate",
  YES: "Adequate",
  "NOT ADEQUATE": "Not Adequate",
  NOTADEQUATE: "Not Adequate",
  NO: "Not Adequate",
  NC: "Not Adequate",
  "N/A": "N/A",
  NA: "N/A",
  "NOT APPLICABLE": "N/A"
};

const HEADER_ALIASES: Record<string, typeof ADHOC_TEMPLATE_COLUMNS[number]> = {
  SRNO: "Sr. No.",
  SERIALNO: "Sr. No.",
  SERIALNUMBER: "Sr. No.",
  "6SCATEGORY": "6S Category",
  CATEGORY: "6S Category",
  OBSERVATION: "Observation / Checkpoint",
  CHECKPOINT: "Observation / Checkpoint",
  OBSERVATIONCHECKPOINT: "Observation / Checkpoint",
  ASSESSMENT: "Assessment",
  RESPONSE: "Assessment",
  RESPONSIBLEDEPARTMENT: "Responsible Department",
  OWNERDEPARTMENT: "Responsible Department",
  RESPONSIBLEPERSON: "Responsible Person",
  ACTIONOWNER: "Responsible Person",
  ASSIGNEE: "Responsible Person",
  SEVERITY: "Severity",
  TARGETDATE: "Target Date",
  DUEDATE: "Target Date",
  REMARKS: "Remarks",
  NOTES: "Remarks",
  BEFOREUPLOAD: "Before Upload",
  BEFOREPHOTO: "Before Upload",
  BEFOREPHOTOS: "Before Upload",
  BEFOREIMAGE: "Before Upload",
  BEFOREIMAGES: "Before Upload",
  BEFOREEVIDENCE: "Before Upload"
};

function compact(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function compactKey(value: unknown) {
  return compact(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function normalizeCategory(value: unknown) {
  const raw = compact(value);
  const category = CATEGORY_ALIASES[compactKey(raw)] || raw.toUpperCase();
  return (CATEGORIES as readonly string[]).includes(category) ? category : "";
}

function normalizeAssessment(value: unknown): Assessment | "" {
  return ASSESSMENT_ALIASES[compactKey(value)] || "";
}

function normalizeSeverity(value: unknown): SeverityValue | "" {
  const raw = compact(value);
  return (SEVERITIES as readonly string[]).find((severity) => severity.toLowerCase() === raw.toLowerCase()) as SeverityValue | undefined || "";
}

function parseExcelDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseBeforeUploadPhotos(value: unknown, importBatchId: string, rowIndex: number) {
  const raw = compact(value);
  if (!raw) return { photos: [] as Array<{ secureUrl: string; publicId: string }>, invalidValues: [] as string[] };

  const values = raw
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const photos: Array<{ secureUrl: string; publicId: string }> = [];
  const invalidValues: string[] = [];

  values.forEach((item, photoIndex) => {
    try {
      const url = new URL(item);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported URL protocol");
      photos.push({
        secureUrl: url.toString(),
        publicId: `adhoc-before-url-${importBatchId}-${rowIndex + 1}-${photoIndex + 1}`
      });
    } catch {
      invalidValues.push(item);
    }
  });

  return { photos, invalidValues };
}

function userMatchKey(value: unknown) {
  return compact(value).toLowerCase();
}

function buildUserMaps(users: AdhocUserLookup[]) {
  const byValue = new Map<string, AdhocUserLookup>();
  for (const user of users) {
    if (user.status === "inactive") continue;
    for (const value of [user.email, user.username, user.name]) {
      const key = userMatchKey(value);
      if (key && !byValue.has(key)) byValue.set(key, user);
    }
  }
  return byValue;
}

function headerName(value: unknown) {
  return HEADER_ALIASES[compactKey(value)] || compact(value);
}

export function validateAdhocWorkbook(input: {
  buffer: Buffer;
  fileName: string;
  departments: string[];
  users: AdhocUserLookup[];
}): AdhocPreviewResult {
  const workbook = XLSX.read(input.buffer, { type: "buffer", cellDates: true, cellFormula: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw Object.assign(new Error("Excel workbook does not contain any sheets."), { status: 400 });

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false });
  if (rows.length === 0) throw Object.assign(new Error("Excel workbook is empty."), { status: 400 });
  if (rows.length > MAX_ADHOC_ROWS) {
    throw Object.assign(new Error(`Excel contains ${rows.length} rows. Maximum allowed rows are ${MAX_ADHOC_ROWS}.`), { status: 400 });
  }

  const normalizedRows = rows
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [headerName(key), value])) as RawRow)
    .filter((row) => !compact(row.Remarks).toLowerCase().includes("sample row - delete"));

  const first = normalizedRows[0] || {};
  const missingColumns = REQUIRED_ADHOC_TEMPLATE_COLUMNS.filter((column) => !(column in first));
  if (missingColumns.length > 0) {
    throw Object.assign(new Error(`Missing required columns: ${missingColumns.join(", ")}`), { status: 400 });
  }

  const usersByValue = buildUserMaps(input.users);
  const fileHash = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const importBatchId = crypto.randomUUID();
  const previewRows: AdhocPreviewRow[] = normalizedRows.map((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rowNumber = index + 2;
    const category = normalizeCategory(row["6S Category"]);
    const observation = compact(row["Observation / Checkpoint"]);
    const assessment = normalizeAssessment(row.Assessment);
    const responsibleDepartment = canonicalDepartmentName(compact(row["Responsible Department"]), input.departments);
    const responsiblePerson = compact(row["Responsible Person"]);
    const severity = normalizeSeverity(row.Severity);
    const targetDate = parseExcelDate(row["Target Date"]);
    const beforeUpload = parseBeforeUploadPhotos(row["Before Upload"], importBatchId, index);

    if (!observation) errors.push("Missing Observation");
    if (!category) errors.push("Invalid 6S Category");
    if (!assessment) errors.push("Invalid Assessment");

    const hasDepartment = responsibleDepartment && input.departments.includes(responsibleDepartment);
    if (assessment === "Not Adequate" && !hasDepartment) errors.push("Unknown Department");
    if (assessment === "Not Adequate" && !responsiblePerson) errors.push("Missing Responsible Person");
    if (assessment === "Not Adequate" && !severity) errors.push("Invalid Severity");
    if (assessment === "Not Adequate" && !targetDate) errors.push("Invalid Target Date");

    const matchedUser = responsiblePerson ? usersByValue.get(userMatchKey(responsiblePerson)) : undefined;
    if (assessment === "Not Adequate" && responsiblePerson && !matchedUser) {
      errors.push("Unknown Responsible Person");
    }

    if (matchedUser?.department && responsibleDepartment) {
      const userDepartment = canonicalDepartmentName(matchedUser.department, input.departments);
      if (userDepartment && userDepartment !== responsibleDepartment) {
        errors.push("Responsible Person does not belong to selected department");
      }
    }

    if (assessment === "Not Adequate" && observation.length < 3) warnings.push("Observation is very short");
    if (beforeUpload.invalidValues.length > 0) warnings.push("Before Upload accepts only public http/https image links; upload files from the preview screen instead");

    return {
      rowNumber,
      srNo: compact(row["Sr. No."]) || String(index + 1),
      category,
      observation,
      assessment,
      responsibleDepartment,
      responsiblePerson: matchedUser?.name || responsiblePerson,
      responsibleUserId: matchedUser?.id,
      severity,
      targetDate,
      remarks: compact(row.Remarks),
      beforePhotos: beforeUpload.photos,
      validationStatus: errors.length ? "INVALID" : warnings.length ? "WARNING" : "VALID",
      errors,
      warnings
    };
  });

  const adequateCount = previewRows.filter((row) => row.assessment === "Adequate").length;
  const notAdequateCount = previewRows.filter((row) => row.assessment === "Not Adequate").length;
  const naCount = previewRows.filter((row) => row.assessment === "N/A").length;
  const invalidRows = previewRows.filter((row) => row.errors.length > 0).length;
  const scoreWarning = adequateCount === 0 && notAdequateCount > 0
    ? "A proper 6S compliance score requires Adequate and Not Adequate assessment data. Please include all assessed checkpoints, not only negative observations."
    : undefined;

  return {
    fileName: input.fileName,
    fileHash,
    importBatchId,
    totalRows: previewRows.length,
    successfulRows: previewRows.length - invalidRows,
    failedRows: invalidRows,
    adequateCount,
    notAdequateCount,
    naCount,
    invalidRows,
    scoreWarning,
    rows: previewRows
  };
}

export function buildAdhocTemplateWorkbook() {
  const sampleRows = [
    [1, "SORT", "Only required materials are present at the audited area.", "Adequate", "Production", "responsible.person@company.com", "Medium", new Date(), "Sample row - delete before import", ""],
    [2, "SAFETY", "Electrical panel access is blocked by stored material.", "Not Adequate", "Maintenance", "maintenance.spoc@company.com", "High", new Date(), "Sample row - delete before import", ""],
    [3, "SHINE", "Machine under maintenance was not assessed.", "N/A", "Production", "", "Low", "", "Sample row - delete before import", ""]
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([[...ADHOC_TEMPLATE_COLUMNS], ...sampleRows]);
  worksheet["!cols"] = [
    { wch: 10 }, { wch: 18 }, { wch: 48 }, { wch: 18 }, { wch: 24 },
    { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 32 }, { wch: 24 }
  ];

  const categorySheet = XLSX.utils.aoa_to_sheet([["6S Category"], ...CATEGORIES.map((category) => [category])]);
  const assessmentSheet = XLSX.utils.aoa_to_sheet([["Assessment"], ...ASSESSMENTS.map((value) => [value])]);
  const severitySheet = XLSX.utils.aoa_to_sheet([["Severity"], ...SEVERITIES.map((value) => [value])]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Adhoc Audit Import");
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories");
  XLSX.utils.book_append_sheet(workbook, assessmentSheet, "Assessments");
  XLSX.utils.book_append_sheet(workbook, severitySheet, "Severities");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
