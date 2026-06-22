import { toCsv } from "@/lib/report-utils";

export function findingsToCsv(findings: Array<Record<string, unknown>>) {
  const headers = ["Finding", "Audit", "Department", "Zone", "Category", "Severity", "Status", "Due Date"];
  const rows = findings.map((f) => [f.findingNumber, f.auditNumber, f.department, f.zone, f.category, f.severity, f.status, f.dueDate]);
  return toCsv(headers, rows);
}
