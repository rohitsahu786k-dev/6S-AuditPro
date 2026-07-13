import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

export type InsightKpi = { label: string; value: string | number };

export type InsightSection = {
  title: string;
  note?: string;
  head: string[];
  rows: Array<Array<string | number>>;
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 13;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = 280;

const NAVY: [number, number, number] = [31, 58, 110];
const DARK: [number, number, number] = [30, 41, 59];
const GREY: [number, number, number] = [100, 116, 139];
const TRACK: [number, number, number] = [226, 232, 240];
const BRAND: [number, number, number] = [185, 28, 28];

// Renders a tabular insights report (dashboard / analytics exports) with the
// same document framing as the audit PDF report.
export async function downloadInsightsPdf(options: {
  title: string;
  subtitle?: string;
  fileName: string;
  kpis: InsightKpi[];
  sections: InsightSection[];
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const tableMargin = { top: 16, bottom: PAGE_H - BOTTOM_LIMIT, left: MARGIN, right: MARGIN };
  let y = 0;

  const finalY = () => (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  function ensureSpace(needed: number) {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage();
      y = 16;
    }
  }

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(options.title, MARGIN, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(options.subtitle || `${APP_NAME} — 6S Audit Control Centre`, MARGIN, 21.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(COMPANY_NAME, PAGE_W - MARGIN, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${new Date().toLocaleTimeString()}`,
    PAGE_W - MARGIN,
    21.5,
    { align: "right" }
  );

  y = 34;

  // KPI tiles
  if (options.kpis.length > 0) {
    const cols = Math.min(6, options.kpis.length);
    const gap = 3;
    const tileW = (CONTENT_W - gap * (cols - 1)) / cols;
    const tileH = 17;
    options.kpis.forEach((kpi, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = MARGIN + col * (tileW + gap);
      const tileY = y + row * (tileH + gap);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, tileY, tileW, tileH, 1.5, 1.5, "F");
      doc.setDrawColor(...TRACK);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, tileY, tileW, tileH, 1.5, 1.5, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...BRAND);
      doc.text(String(kpi.value), x + tileW / 2, tileY + 8, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(...GREY);
      doc.text(kpi.label.toUpperCase(), x + tileW / 2, tileY + 13.5, { align: "center" });
    });
    y += Math.ceil(options.kpis.length / cols) * (tileH + gap) + 4;
  }

  // Sections
  for (const section of options.sections) {
    if (section.rows.length === 0) continue;
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...DARK);
    doc.text(section.title, MARGIN, y + 5);
    if (section.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...GREY);
      doc.text(section.note, PAGE_W - MARGIN, y + 5, { align: "right" });
    }
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: tableMargin,
      head: [section.head],
      body: section.rows.map((row) => row.map((cell) => String(cell))),
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "middle", lineColor: TRACK, lineWidth: 0.15 },
      alternateRowStyles: { fillColor: [247, 250, 253] },
      columnStyles: { 0: { fontStyle: "bold" } }
    });
    y = finalY() + 9;
  }

  // Footer on every page
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

  doc.save(options.fileName);
}
