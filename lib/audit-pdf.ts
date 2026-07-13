import { CATEGORIES, CATEGORY_META, APP_NAME, COMPANY_NAME } from "@/lib/constants";

export type AuditPdfPhoto = { secureUrl: string; publicId?: string };

export type AuditPdfData = {
  _id?: string;
  auditNumber: string;
  zone: string;
  department: string;
  auditorName: string;
  date: string;
  totalScore: number;
  categoryScores?: Record<string, number | { score?: number }>;
  findingIds?: string[];
  checklist: Array<{
    questionId?: string;
    category: string;
    question: string;
    response: string;
    observation?: string;
    severity?: string;
    beforePhotos?: AuditPdfPhoto[];
  }>;
};

type PdfFinding = {
  _id: string;
  findingNumber: string;
  auditId?: string;
  auditNumber?: string;
  category: string;
  question: string;
  severity?: string;
  status?: string;
  observation?: string;
  capaAction?: string;
  closureRemarks?: string;
  zone?: string;
  beforePhotos?: AuditPdfPhoto[];
  afterPhotos?: AuditPdfPhoto[];
};

type MastersData = {
  zones?: Array<{ name: string; department: string; location?: string }>;
  questions?: Array<{ _id: string; category: string; text: string; subSection?: string }>;
};

type LoadedImage = { data: string; width: number; height: number };

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 13;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = 280;

const NAVY: [number, number, number] = [31, 58, 110];
const MAROON: [number, number, number] = [150, 32, 32];
const RED: [number, number, number] = [192, 44, 44];
const GREEN: [number, number, number] = [21, 128, 61];
const ORANGE: [number, number, number] = [230, 126, 34];
const AMBER: [number, number, number] = [217, 119, 6];
const BLUE: [number, number, number] = [37, 99, 235];
const VIOLET: [number, number, number] = [109, 40, 217];
const GREY: [number, number, number] = [100, 116, 139];
const DARK: [number, number, number] = [30, 41, 59];
const TRACK: [number, number, number] = [226, 232, 240];

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  Critical: [220, 38, 38],
  High: [234, 88, 12],
  Medium: AMBER,
  Low: BLUE
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  REOPENED: "Reopened",
  OVERDUE: "Overdue"
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  Open: RED,
  "In Progress": BLUE,
  Submitted: AMBER,
  Closed: GREEN,
  Rejected: RED,
  Reopened: ORANGE,
  Overdue: VIOLET
};

function categoryScoreValue(value: number | { score?: number } | undefined) {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" ? value : value.score ?? 0;
}

function ratingFor(score: number) {
  if (score >= 90) return { code: "6S", label: "Excellent" };
  if (score >= 80) return { code: "5S", label: "Very Good" };
  if (score >= 70) return { code: "4S", label: "Good" };
  if (score >= 50) return { code: "3S", label: "Fair" };
  if (score >= 30) return { code: "2S", label: "Poor" };
  return { code: "1S", label: "Critical" };
}

function scoreBandColor(score: number): [number, number, number] {
  if (score >= 90) return [22, 163, 74];
  if (score >= 50) return ORANGE;
  return RED;
}

function barColor(score: number): [number, number, number] {
  if (score >= 90) return [13, 148, 136];
  if (score >= 60) return BLUE;
  if (score >= 35) return ORANGE;
  return RED;
}

function complianceColor(score: number): [number, number, number] {
  if (score >= 90) return GREEN;
  if (score >= 50) return ORANGE;
  return RED;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value || "")
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
}

async function fetchApi<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.ok === false) return null;
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

// Loads a remote photo and re-encodes it as JPEG through a canvas so jsPDF can
// embed it (source files are usually WebP, which jsPDF cannot decode).
function loadImageAsJpeg(url: string): Promise<LoadedImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 20000);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const maxDim = 1000;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL("image/jpeg", 0.82), width: canvas.width, height: canvas.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function downloadAuditPdf(audit: AuditPdfData) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);

  // Supporting data (best-effort — the report still renders if any call fails).
  const [allFindings, masters, me] = await Promise.all([
    fetchApi<PdfFinding[]>("/api/findings?view=full"),
    fetchApi<MastersData>("/api/masters"),
    fetchApi<{ user?: { name?: string } | null }>("/api/auth/me")
  ]);

  const findingIdSet = new Set((audit.findingIds || []).map(String));
  const auditFindings = (allFindings || []).filter((finding) =>
    (audit._id && String(finding.auditId) === String(audit._id)) ||
    findingIdSet.has(String(finding._id)) ||
    (finding.auditNumber && finding.auditNumber === audit.auditNumber)
  );

  const subSectionByQuestion = new Map<string, string>();
  for (const question of masters?.questions || []) {
    if (question.subSection) subSectionByQuestion.set(String(question._id), question.subSection);
  }
  const zoneLocation = masters?.zones?.find((zone) => zone.name === audit.zone)?.location || "";
  const generatedBy = me?.user?.name || "System";

  // ----- Derived checklist statistics -----
  const orderedCategories = [
    ...CATEGORIES.filter((category) => audit.checklist.some((item) => item.category === category)),
    ...[...new Set(audit.checklist.map((item) => item.category))].filter((category) => !(CATEGORIES as readonly string[]).includes(category))
  ];

  const categoryStats = orderedCategories.map((category) => {
    const items = audit.checklist.filter((item) => item.category === category);
    const adequate = items.filter((item) => item.response === "Adequate").length;
    const notAdequate = items.filter((item) => item.response === "Not Adequate").length;
    const na = items.filter((item) => item.response === "N/A").length;
    const stored = categoryScoreValue(audit.categoryScores?.[category]);
    const computed = adequate + notAdequate > 0 ? Math.round((adequate / (adequate + notAdequate)) * 100) : 100;
    const score = stored ?? computed;
    return { category, adequate, notAdequate, na, score };
  });

  const flaggedItems = audit.checklist.filter((item) => item.response === "Not Adequate");
  const severityOrder = ["Critical", "High", "Medium", "Low"];
  const severityCounts = severityOrder.map((severity) => ({
    severity,
    count: flaggedItems.filter((item) => (item.severity || "Medium") === severity).length
  }));
  const totalFlagged = flaggedItems.length;

  // ----- Safety insight areas (grouped by question sub-section) -----
  const safetyItems = audit.checklist.filter((item) => item.category === "SAFETY");
  const safetyAreaNames: string[] = [];
  for (const item of safetyItems) {
    const area = subSectionByQuestion.get(String(item.questionId || "")) || "General Safety";
    if (!safetyAreaNames.includes(area)) safetyAreaNames.push(area);
  }
  const safetyAreas = safetyAreaNames.map((name) => {
    const items = safetyItems.filter((item) => (subSectionByQuestion.get(String(item.questionId || "")) || "General Safety") === name);
    const adequate = items.filter((item) => item.response === "Adequate").length;
    const flagged = items.filter((item) => item.response === "Not Adequate").length;
    const na = items.filter((item) => item.response === "N/A").length;
    const compliance = adequate + flagged > 0 ? Math.round((adequate / (adequate + flagged)) * 100) : 100;
    return { name, checked: items.length, adequate, flagged, na, compliance };
  });
  const flaggedSafetyItems = safetyItems
    .filter((item) => item.response === "Not Adequate")
    .sort((a, b) => severityOrder.indexOf(a.severity || "Medium") - severityOrder.indexOf(b.severity || "Medium"))
    .map((item) => ({
      area: subSectionByQuestion.get(String(item.questionId || "")) || "General Safety",
      severity: item.severity || "Medium",
      question: item.question,
      observation: item.observation || ""
    }));

  // ----- Findings summary rows -----
  const pendingClosureText = "Pending closure — corrective action not yet submitted by the zone owner.";
  const findingRows = auditFindings.length
    ? auditFindings.map((finding) => ({
        category: finding.category,
        severity: finding.severity || "Medium",
        zone: finding.zone || audit.zone,
        question: finding.question,
        status: STATUS_LABELS[finding.status || ""] || finding.status || "Open",
        capa: finding.capaAction ? finding.capaAction : "Pending"
      }))
    : flaggedItems.map((item) => ({
        category: item.category,
        severity: item.severity || "Medium",
        zone: audit.zone,
        question: item.question,
        status: "Open",
        capa: "Pending"
      }));

  // ----- Before / after photo evidence cards -----
  type PhotoCard = {
    question: string;
    observation: string;
    capaText: string;
    closed: boolean;
    beforeUrl?: string;
    afterUrl?: string;
    before?: LoadedImage | null;
    after?: LoadedImage | null;
  };

  const cardSource: PhotoCard[] = (auditFindings.length
    ? auditFindings.map((finding) => ({
        question: finding.question,
        observation: finding.observation || "",
        capaText: finding.capaAction
          ? `${finding.capaAction}${finding.closureRemarks ? ` — ${finding.closureRemarks}` : ""}`
          : pendingClosureText,
        closed: (finding.status || "") === "CLOSED" || Boolean(finding.capaAction),
        beforeUrl: finding.beforePhotos?.[0]?.secureUrl,
        afterUrl: finding.afterPhotos?.[0]?.secureUrl
      }))
    : flaggedItems.map((item) => ({
        question: item.question,
        observation: item.observation || "",
        capaText: pendingClosureText,
        closed: false,
        beforeUrl: item.beforePhotos?.[0]?.secureUrl,
        afterUrl: undefined
      }))
  ).filter((card) => card.beforeUrl || card.afterUrl);

  await mapLimit(cardSource, 4, async (card) => {
    card.before = card.beforeUrl ? await loadImageAsJpeg(card.beforeUrl) : null;
    card.after = card.afterUrl ? await loadImageAsJpeg(card.afterUrl) : null;
    return card;
  });

  // ----- Document -----
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const rating = ratingFor(audit.totalScore);
  const dateLabel = formatDate(audit.date);
  const tableMargin = { top: 16, bottom: PAGE_H - BOTTOM_LIMIT, left: MARGIN, right: MARGIN };
  let y = 0;

  const finalY = () => (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  function ensureSpace(needed: number) {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      y = 16;
    }
  }

  function sectionHeading(text: string) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...DARK);
    doc.text(text, MARGIN, y + 6);
    y += 9;
  }

  // ===== Page 1: header band =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("6S AUDIT REPORT", MARGIN, 13.5);
  doc.setFontSize(11);
  doc.text(audit.auditNumber, PAGE_W - MARGIN, 13.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${audit.zone}  |  ${audit.department}  |  ${audit.auditorName}  |  ${dateLabel}`, MARGIN, 23);
  doc.text(COMPANY_NAME, PAGE_W - MARGIN, 23, { align: "right" });

  // ===== Score card + category bars + severity =====
  const topY = 36;
  const cardH = 58;
  const band = scoreBandColor(audit.totalScore);
  doc.setFillColor(...band);
  doc.roundedRect(MARGIN, topY, 52, cardH, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.text(`${audit.totalScore}%`, MARGIN + 26, topY + 18, { align: "center" });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 12, topY + 23, MARGIN + 40, topY + 23);
  doc.setFontSize(16);
  doc.text(rating.code, MARGIN + 26, topY + 33, { align: "center" });
  doc.setFontSize(7);
  doc.text(audit.totalScore >= 90 ? "SATISFACTORY" : "NEEDS IMPROVEMENT", MARGIN + 26, topY + 43, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Target: 90%+", MARGIN + 26, topY + 51, { align: "center" });

  // Category score bars
  const catX = 71;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("CATEGORY SCORES", catX, topY + 2.5);
  const catRowH = (cardH - 8) / Math.max(categoryStats.length, 1);
  categoryStats.forEach((stat, index) => {
    const rowY = topY + 7 + index * catRowH;
    const short = CATEGORY_META[stat.category as keyof typeof CATEGORY_META]?.short || "";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...DARK);
    doc.text(`${short} ${titleCase(stat.category)}`.trim(), catX, rowY + 3.4);
    // Track + fill
    const barX = catX + 28;
    const barW = 36;
    doc.setFillColor(...TRACK);
    doc.rect(barX, rowY + 0.8, barW, 3.4, "F");
    const fill = barColor(stat.score);
    const fillW = Math.max(0, Math.min(barW, (barW * stat.score) / 100));
    doc.setFillColor(...fill);
    doc.rect(barX, rowY + 0.8, fillW, 3.4, "F");
    doc.setFontSize(5.4);
    if (fillW > 9) {
      doc.setTextColor(255, 255, 255);
      doc.text(`${stat.score}%`, barX + fillW - 1, rowY + 3.3, { align: "right" });
    } else {
      doc.setTextColor(...DARK);
      doc.text(`${stat.score}%`, barX + fillW + 1, rowY + 3.3);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.setTextColor(...GREY);
    doc.text(`${stat.adequate}/${stat.adequate + stat.notAdequate}`, catX + 75, rowY + 3.3, { align: "right" });
  });

  // Severity panel
  const sevX = 152;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("SEVERITY", sevX, topY + 2.5);
  severityCounts.forEach((entry, index) => {
    const rowY = topY + 7 + index * 10;
    const color = SEVERITY_COLORS[entry.severity] || GREY;
    doc.setFillColor(...color);
    doc.roundedRect(sevX, rowY, 2.6, 2.6, 0.6, 0.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...DARK);
    doc.text(entry.severity, sevX + 4.5, rowY + 2.3);
    doc.text(String(entry.count), PAGE_W - MARGIN, rowY + 2.3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.setTextColor(...GREY);
    const share = totalFlagged ? Math.round((entry.count / totalFlagged) * 100) : 0;
    doc.text(`${share}%`, PAGE_W - MARGIN - 7, rowY + 2.3, { align: "right" });
    doc.setFillColor(...TRACK);
    doc.rect(sevX, rowY + 4, 45, 1.8, "F");
    doc.setFillColor(...color);
    doc.rect(sevX, rowY + 4, Math.max(0, (45 * share) / 100), 1.8, "F");
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...DARK);
  doc.text(`Total: ${totalFlagged}`, PAGE_W - MARGIN, topY + 7 + severityCounts.length * 10 + 2, { align: "right" });

  // Note strip
  y = topY + cardH + 6;
  doc.setFillColor(231, 246, 237);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.2);
  doc.setTextColor(22, 101, 52);
  doc.text("Note: A score of 90% or above shall be considered as a satisfactory score for this 6S compliance report.", MARGIN + 3, y + 5.2);
  y += 13;

  // ===== Critical Safety Insights =====
  if (safetyAreas.length > 0) {
    const areaLabel = formatList(safetyAreaNames);
    let insightsTitle = `Critical Safety Insights  —  ${areaLabel}`;
    doc.setFont("helvetica", "bold");
    let titleSize = 10.5;
    doc.setFontSize(titleSize);
    while (doc.getTextWidth(insightsTitle) > CONTENT_W - 8 && titleSize > 7.5) {
      titleSize -= 0.5;
      doc.setFontSize(titleSize);
    }
    if (doc.getTextWidth(insightsTitle) > CONTENT_W - 8) insightsTitle = "Critical Safety Insights — Safety Compliance Overview";

    doc.setFillColor(253, 235, 235);
    doc.rect(MARGIN, y, CONTENT_W, 8.5, "F");
    doc.setFillColor(...RED);
    doc.rect(MARGIN, y, 1.8, 8.5, "F");
    doc.setTextColor(...MAROON);
    doc.text(insightsTitle, MARGIN + 4.5, y + 5.7);
    y += 11;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.2);
    doc.setTextColor(...GREY);
    doc.text(`Safety items flagged in this audit under SAFETY > ${safetyAreaNames.join(", ")}.`, MARGIN, y + 2);
    y += 5;

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      head: [["Safety Area", "Checked", "Adequate", "Flagged", "N/A", "Compliance", "Status"]],
      body: safetyAreas.map((area) => [
        area.name,
        String(area.checked),
        String(area.adequate),
        String(area.flagged),
        String(area.na),
        `${area.compliance}%`,
        area.flagged > 0 ? "Action Required" : "Compliant"
      ]),
      theme: "grid",
      headStyles: { fillColor: MAROON, textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
      styles: { fontSize: 7.5, cellPadding: 2.2, halign: "center", valign: "middle", lineColor: [226, 232, 240], lineWidth: 0.15 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 44 } },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const area = safetyAreas[data.row.index];
        if (!area) return;
        if (data.column.index === 3 && area.flagged > 0) {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 5) {
          data.cell.styles.textColor = complianceColor(area.compliance);
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 6) {
          data.cell.styles.textColor = area.flagged > 0 ? RED : GREEN;
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    y = finalY() + 7;

    // Flagged items list
    if (flaggedSafetyItems.length > 0) {
      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...MAROON);
      doc.text(`Flagged Items Requiring Action (${flaggedSafetyItems.length})`, MARGIN, y + 3);
      y += 8;

      for (const item of flaggedSafetyItems) {
        const questionLines = doc.splitTextToSize(item.question, CONTENT_W - 8);
        const obsLines = item.observation ? doc.splitTextToSize(`Observation: ${item.observation}`, CONTENT_W - 10) : [];
        const blockH = 4 + questionLines.length * 3.8 + obsLines.length * 3.2 + 4;
        ensureSpace(blockH);
        const sevColor = SEVERITY_COLORS[item.severity] || GREY;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...sevColor);
        doc.text(`• ${item.area}  —  ${item.severity}`, MARGIN + 1, y + 3);
        y += 4.5;
        doc.setFontSize(8.2);
        doc.setTextColor(...DARK);
        doc.text(questionLines, MARGIN + 5, y + 3);
        y += questionLines.length * 3.8;
        if (obsLines.length) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.2);
          doc.setTextColor(...GREY);
          doc.text(obsLines, MARGIN + 7, y + 2.6);
          y += obsLines.length * 3.2;
        }
        y += 3;
      }
      y += 2;
    }
  }

  // ===== Audit Information =====
  ensureSpace(64);
  sectionHeading("Audit Information");
  const infoRows: Array<[string, string]> = [
    ["Zone:", audit.zone],
    ["Department:", audit.department],
    ["Location:", zoneLocation || "-"],
    ["Auditor:", audit.auditorName],
    ["Date:", dateLabel],
    ["Generated By:", generatedBy],
    ["Total Score:", `${audit.totalScore}%`],
    ["6S Rating:", `${rating.code} (${rating.label})`]
  ];
  for (const [label, value] of infoRows) {
    ensureSpace(6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(label, MARGIN, y + 4);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), MARGIN + 44, y + 4);
    y += 6.2;
  }
  y += 4;

  // ===== Category Scores table =====
  sectionHeading("Category Scores");
  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    head: [["Category", "Score", "Adequate", "Not Adeq.", "N/A", "Rating", "Status"]],
    body: categoryStats.map((stat) => {
      const catRating = ratingFor(stat.score);
      return [
        stat.category,
        `${stat.score}%`,
        String(stat.adequate),
        String(stat.notAdequate),
        String(stat.na),
        `${catRating.code} - ${catRating.label}`,
        stat.score >= 90 ? "OK - Satisfactory" : "Needs Improvement"
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 2.2, valign: "middle", lineColor: [226, 232, 240], lineWidth: 0.15 },
    alternateRowStyles: { fillColor: [247, 250, 253] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" }
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const stat = categoryStats[data.row.index];
      if (!stat) return;
      if (data.column.index === 1) {
        data.cell.styles.textColor = complianceColor(stat.score);
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 6) {
        data.cell.styles.textColor = stat.score >= 90 ? GREEN : RED;
        data.cell.styles.fontStyle = "bold";
      }
    }
  });
  y = finalY() + 9;

  // ===== Findings Summary =====
  if (findingRows.length > 0) {
    sectionHeading(`Findings Summary (${findingRows.length})`);
    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      head: [["#", "Category", "Severity", "Zone", "Question", "Status", "Corrective Action"]],
      body: findingRows.map((row, index) => [
        String(index + 1),
        row.category,
        row.severity,
        row.zone,
        row.question,
        row.status,
        row.capa
      ]),
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "top", lineColor: [226, 232, 240], lineWidth: 0.15 },
      alternateRowStyles: { fillColor: [247, 250, 253] },
      columnStyles: {
        0: { cellWidth: 7, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: 16 },
        3: { cellWidth: 24 },
        5: { cellWidth: 17 },
        6: { cellWidth: 28 }
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const row = findingRows[data.row.index];
        if (!row) return;
        if (data.column.index === 2) {
          data.cell.styles.textColor = SEVERITY_COLORS[row.severity] || GREY;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 5) {
          data.cell.styles.textColor = STATUS_COLORS[row.status] || GREY;
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    y = finalY() + 9;
  }

  // ===== Before vs After photo evidence =====
  if (cardSource.length > 0) {
    sectionHeading("Before vs After Photo Evidence");
    const colW = (CONTENT_W - 4) / 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colW + 4;
    const lightBlue: [number, number, number] = [224, 235, 250];
    const lightGreen: [number, number, number] = [222, 245, 229];

    for (const card of cardSource) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      const titleLines = doc.splitTextToSize(card.question, CONTENT_W - 6).slice(0, 2);
      const titleH = 4 + titleLines.length * 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const obsLines = doc.splitTextToSize(card.observation || "No observation recorded.", colW - 6).slice(0, 16);
      const capaLines = doc.splitTextToSize(card.capaText, colW - 6).slice(0, 16);
      const textH = Math.max(obsLines.length, capaLines.length) * 3.3 + 3;
      const photoH = card.before || card.after ? 58 : 24;
      const totalH = titleH + 6.5 + photoH + 1.5 + 5.5 + textH + 8;
      ensureSpace(Math.min(totalH, BOTTOM_LIMIT - 16));

      // Title bar
      doc.setFillColor(233, 240, 251);
      doc.rect(MARGIN, y, CONTENT_W, titleH, "F");
      doc.setDrawColor(...TRACK);
      doc.setLineWidth(0.2);
      doc.rect(MARGIN, y, CONTENT_W, titleH, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...NAVY);
      doc.text(titleLines, MARGIN + 3, y + 4.6);
      y += titleH + 1;

      // Column headers
      doc.setFillColor(...lightBlue);
      doc.rect(leftX, y, colW, 5.5, "F");
      doc.setFillColor(...lightGreen);
      doc.rect(rightX, y, colW, 5.5, "F");
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text("BEFORE PHOTO", leftX + colW / 2, y + 3.8, { align: "center" });
      doc.setTextColor(...GREEN);
      doc.text("AFTER PHOTO", rightX + colW / 2, y + 3.8, { align: "center" });
      y += 6.5;

      // Photo boxes
      const drawPhotoBox = (x: number, image: LoadedImage | null | undefined, emptyText: string) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(x, y, colW, photoH, "F");
        doc.setDrawColor(...TRACK);
        doc.rect(x, y, colW, photoH, "S");
        if (image) {
          const pad = 2;
          const maxW = colW - pad * 2;
          const maxH = photoH - pad * 2;
          const scale = Math.min(maxW / image.width, maxH / image.height);
          const w = image.width * scale;
          const h = image.height * scale;
          try {
            doc.addImage(image.data, "JPEG", x + (colW - w) / 2, y + (photoH - h) / 2, w, h);
          } catch {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(...GREY);
            doc.text("Photo unavailable", x + colW / 2, y + photoH / 2, { align: "center" });
          }
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(...GREY);
          doc.text(emptyText, x + colW / 2, y + photoH / 2, { align: "center" });
        }
      };
      drawPhotoBox(leftX, card.before, card.beforeUrl ? "Photo unavailable" : "No photo captured");
      drawPhotoBox(rightX, card.after, card.afterUrl ? "Photo unavailable" : "Pending closure");
      y += photoH + 1.5;

      // Note headers
      doc.setFillColor(...lightBlue);
      doc.rect(leftX, y, colW, 5, "F");
      doc.setFillColor(...lightGreen);
      doc.rect(rightX, y, colW, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      doc.setTextColor(...NAVY);
      doc.text("AUDITOR'S OBSERVATION", leftX + 2, y + 3.4);
      doc.setTextColor(...GREEN);
      doc.text("ZONE OWNER'S CORRECTIVE ACTION", rightX + 2, y + 3.4);
      y += 6.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 72, 88);
      doc.text(obsLines, leftX + 2, y + 2.4);
      doc.text(capaLines, rightX + 2, y + 2.4);
      y += textH + 8;
    }
  }

  // ===== Complete audit responses =====
  sectionHeading(`Complete Audit Responses (All ${audit.checklist.length} Questions)`);
  autoTable(doc, {
    startY: y,
    margin: tableMargin,
    head: [["#", "Category", "Question", "Response", "Observation"]],
    body: audit.checklist.map((item, index) => [
      String(index + 1),
      item.category,
      item.question,
      item.response,
      item.observation || ""
    ]),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "top", lineColor: [226, 232, 240], lineWidth: 0.15 },
    alternateRowStyles: { fillColor: [247, 250, 253] },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 24 },
      3: { cellWidth: 20 },
      4: { cellWidth: 52 }
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const item = audit.checklist[data.row.index];
      if (!item) return;
      if (data.column.index === 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = item.response === "Adequate" ? GREEN : item.response === "Not Adequate" ? RED : GREY;
      }
    }
  });

  // ===== Footer on every page =====
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...TRACK);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...DARK);
    doc.text("Document Classified As: Limited Internal Distribution.", MARGIN, 288.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    doc.text("IMS-16-04-L4-07  Rev.03", PAGE_W - MARGIN, 288.5, { align: "right" });
    doc.setFontSize(6.4);
    doc.text(`${APP_NAME}  |  ${COMPANY_NAME}`, MARGIN, 292.2);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_W - MARGIN, 292.2, { align: "right" });
  }

  const safeName = audit.auditNumber.replace(/[^a-z0-9-_]/gi, "_");
  doc.save(`${safeName}_Audit_Report.pdf`);
}
