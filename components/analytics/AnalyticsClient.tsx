"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Filter
} from "lucide-react";

type Audit = {
  _id: string;
  auditNumber: string;
  zone: string;
  department: string;
  auditorName: string;
  date: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  totalScore: number;
  categoryScores?: Record<string, number>;
  checklist: Array<{
    questionId: string;
    category: string;
    question: string;
    response: "Adequate" | "Not Adequate" | "N/A";
    severity?: string;
  }>;
};

type Finding = {
  _id: string;
  findingNumber: string;
  auditNumber?: string;
  zone: string;
  department: string;
  category: string;
  question: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "OPEN" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED" | "REJECTED" | "REOPENED" | "OVERDUE";
  dueDate?: string;
  observation?: string;
};

export function AnalyticsClient() {
  const auditsApi = useApi<Audit[]>("/api/audits?view=analytics");
  const findingsApi = useApi<Finding[]>("/api/findings?view=summary");

  const audits = auditsApi.data || [];
  const findings = findingsApi.data || [];

  // Active view: Dashboard vs Exports
  const [activeSubView, setActiveSubView] = useState<"dashboard" | "exports">("dashboard");

  // Export filters
  const [exportType, setExportType] = useState<"audits" | "findings">("findings");
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Aggregate Outstanding Finding Counters
  const counters = useMemo(() => {
    const total = findings.length;
    const open = findings.filter(f => f.status === "OPEN" || f.status === "REOPENED").length;
    const submitted = findings.filter(f => f.status === "SUBMITTED").length;
    const closed = findings.filter(f => f.status === "CLOSED").length;
    
    // Calculate actual overdue based on due date
    const overdue = findings.filter(f => {
      if (f.status === "CLOSED") return false;
      if (f.status === "OVERDUE") return true;
      if (f.dueDate && new Date(f.dueDate) < new Date()) return true;
      return false;
    }).length;

    return { total, open, submitted, closed, overdue };
  }, [findings]);

  // Average Department Scores
  const departmentStats = useMemo(() => {
    const map = new Map<string, { totalScore: number; count: number; openFindings: number }>();
    
    // Audits scores
    for (const a of audits) {
      if (a.status !== "COMPLETED") continue;
      const dept = a.department;
      const stats = map.get(dept) || { totalScore: 0, count: 0, openFindings: 0 };
      stats.totalScore += a.totalScore || 0;
      stats.count += 1;
      map.set(dept, stats);
    }

    // Open findings count
    for (const f of findings) {
      if (f.status !== "CLOSED") {
        const stats = map.get(f.department) || { totalScore: 0, count: 0, openFindings: 0 };
        stats.openFindings += 1;
        map.set(f.department, stats);
      }
    }

    return [...map.entries()].map(([department, s]) => ({
      department,
      avgScore: s.count > 0 ? Math.round(s.totalScore / s.count) : 0,
      auditCount: s.count,
      openFindings: s.openFindings
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [audits, findings]);

  // 1S - 7S Category-Wise Score Breakdowns
  const pillarStats = useMemo(() => {
    const pillars = ["1S", "2S", "3S", "4S", "5S", "6S", "7S"];
    const labels: Record<string, string> = {
      "1S": "Sort (Seiri)",
      "2S": "Set In Order (Seiton)",
      "3S": "Shine (Seiso)",
      "4S": "Standardize (Seiketsu)",
      "5S": "Sustain (Shitsuke)",
      "6S": "Safety (Anzen)",
      "7S": "Security (Bohan)"
    };

    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const a of audits) {
      if (a.status !== "COMPLETED") continue;
      
      // If a.categoryScores exists, extract from there
      if (a.categoryScores) {
        for (const [pil, val] of Object.entries(a.categoryScores)) {
          sums[pil] = (sums[pil] || 0) + Number(val);
          counts[pil] = (counts[pil] || 0) + 1;
        }
      } else {
        // Fallback: calculate from checklist items
        const catGroup: Record<string, { yes: number; total: number }> = {};
        for (const item of a.checklist) {
          if (!catGroup[item.category]) catGroup[item.category] = { yes: 0, total: 0 };
          if (item.response === "Adequate") {
            catGroup[item.category].yes += 1;
            catGroup[item.category].total += 1;
          } else if (item.response === "Not Adequate") {
            catGroup[item.category].total += 1;
          }
        }
        for (const [pil, data] of Object.entries(catGroup)) {
          const score = data.total > 0 ? (data.yes / data.total) * 100 : 0;
          sums[pil] = (sums[pil] || 0) + score;
          counts[pil] = (counts[pil] || 0) + 1;
        }
      }
    }

    return pillars.map(pil => {
      const avg = counts[pil] > 0 ? Math.round(sums[pil] / counts[pil]) : 0;
      return {
        pillar: pil,
        label: labels[pil] || pil,
        avgScore: avg
      };
    });
  }, [audits]);

  // Department vs Severity heatmap
  const severityHeatmap = useMemo(() => {
    const map = new Map<string, { Critical: number; High: number; Medium: number; Low: number; total: number }>();
    for (const f of findings) {
      const row = map.get(f.department) || { Critical: 0, High: 0, Medium: 0, Low: 0, total: 0 };
      row[f.severity] = (row[f.severity] || 0) + 1;
      row.total += 1;
      map.set(f.department, row);
    }
    return [...map.entries()].map(([department, row]) => ({ department, ...row })).sort((a, b) => b.total - a.total);
  }, [findings]);

  function heatmapCellClass(count: number, severity: "Critical" | "High" | "Medium" | "Low") {
    if (count === 0) return "text-t3";
    const intensity: Record<string, string> = {
      Critical: "bg-[#fecaca] text-[#7f1d1d]",
      High: "bg-[#fed7aa] text-[#7c2d12]",
      Medium: "bg-[#fde68a] text-[#78350f]",
      Low: "bg-[#bfdbfe] text-[#1e3a8a]"
    };
    return `${intensity[severity]} font-bold`;
  }

  // Unique lists for export filters
  const uniqueDepts = useMemo(() => {
    const list = new Set(audits.map(a => a.department));
    return Array.from(list);
  }, [audits]);

  // Filtered dataset for exports
  const filteredData = useMemo<any[]>(() => {
    if (exportType === "audits") {
      return audits.filter(a => {
        const matchDept = filterDept === "ALL" || a.department === filterDept;
        const matchStatus = filterStatus === "ALL" || a.status === filterStatus;
        const matchStart = !startDate || new Date(a.date) >= new Date(startDate);
        const matchEnd = !endDate || new Date(a.date) <= new Date(endDate);
        return matchDept && matchStatus && matchStart && matchEnd;
      });
    } else {
      return findings.filter(f => {
        const matchDept = filterDept === "ALL" || f.department === filterDept;
        const matchSeverity = filterSeverity === "ALL" || f.severity === filterSeverity;
        const matchStatus = filterStatus === "ALL" || f.status === filterStatus;
        const matchStart = !startDate || (f.dueDate && new Date(f.dueDate) >= new Date(startDate));
        const matchEnd = !endDate || (f.dueDate && new Date(f.dueDate) <= new Date(endDate));
        return matchDept && matchSeverity && matchStatus && matchStart && matchEnd;
      });
    }
  }, [exportType, filterDept, filterSeverity, filterStatus, startDate, endDate, audits, findings]);

  // Export to CSV Function
  function downloadCSV() {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "";

    if (exportType === "audits") {
      filename = `6S_Audit_Summary_Report_${new Date().toISOString().split("T")[0]}.csv`;
      headers = ["Audit Number", "Department", "Zone", "Auditor Name", "Date Completed", "Score (%)", "Status"];
      rows = filteredData.map((item: any) => [
        item.auditNumber,
        item.department,
        item.zone,
        item.auditorName,
        item.date ? new Date(item.date).toLocaleDateString() : "",
        item.totalScore.toString(),
        item.status
      ]);
    } else {
      filename = `6S_Findings_CAPA_Report_${new Date().toISOString().split("T")[0]}.csv`;
      headers = ["Finding ID", "Audit Ref", "Category", "Department", "Zone", "Severity", "Target Due Date", "Status", "Observation / Question"];
      rows = filteredData.map((item: any) => [
        item.findingNumber,
        item.auditNumber || "Manual",
        item.category,
        item.department,
        item.zone,
        item.severity,
        item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "N/A",
        item.status,
        `"${item.question.replace(/"/g, '""')}"`
      ]);
    }

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Print Preview triggers window print stylesheet layout
  function triggerPrint() {
    window.print();
  }

  return (
    <>
      {/* Top Header */}
      <div className="mb-[18px] flex items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Analytics & Compliance Insights</h1>
          <p className="mt-1 text-sm text-t2">Monitor key aggregate trends, category-wise breakdowns, and export print-ready tabular sheets.</p>
        </div>
        <div className="flex gap-1.5">
          <button
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-bold hover:bg-bg3 ${
              activeSubView === "dashboard" ? "border-brand bg-brand text-white hover:bg-brand-d" : "border-bd bg-white text-t1"
            }`}
            onClick={() => setActiveSubView("dashboard")}
          >
            <BarChart3 size={16} /> Dashboards
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-bold hover:bg-bg3 ${
              activeSubView === "exports" ? "border-brand bg-brand text-white hover:bg-brand-d" : "border-bd bg-white text-t1"
            }`}
            onClick={() => setActiveSubView("exports")}
          >
            <Printer size={16} /> Reports & Exports
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE DASHBOARD */}
      {activeSubView === "dashboard" && (
        <div className="print:hidden">
          {/* Live Counters */}
          <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <div className="rounded-lg bg-[#f1f5f9] p-2.5 text-t1">
                <Layers size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase text-t2">Total Logged</div>
                <div className="text-xl font-bold">{counters.total}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <div className="rounded-lg bg-[#fffbeb] p-2.5 text-[#b45309]">
                <Clock size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase text-t2">Open & Active</div>
                <div className="text-xl font-bold text-[#b45309]">{counters.open}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <div className="rounded-lg bg-[#e0f2fe] p-2.5 text-[#0369a1]">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase text-t2">CAPA Review</div>
                <div className="text-xl font-bold text-[#0369a1]">{counters.submitted}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <div className="rounded-lg bg-[#fee2e2] p-2.5 text-[#b91c1c]">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase text-t2">Overdue Findings</div>
                <div className="text-xl font-bold text-[#b91c1c]">{counters.overdue}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <div className="rounded-lg bg-[#f0fdf4] p-2.5 text-[#15803d]">
                <CheckCircle size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase text-t2">Resolved / Closed</div>
                <div className="text-xl font-bold text-[#15803d]">{counters.closed}</div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Department Performance */}
            <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <h3 className="mb-2.5 flex items-center justify-between font-extrabold text-t1">
                <span>Department Audit Scores</span>
                <span className="text-[11px] text-t2">Active Averages</span>
              </h3>
              <div className="mt-2.5 grid gap-3.5">
                {departmentStats.length === 0 ? (
                  <div className="p-5 text-center text-t2">No audit score data found.</div>
                ) : (
                  departmentStats.map((d) => (
                    <div key={d.department} className="grid gap-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-semibold">{d.department}</span>
                        <div className="flex gap-2.5">
                          <span className="text-t2">{d.auditCount} Audits</span>
                          <strong className={d.avgScore >= 80 ? "text-green" : d.avgScore >= 50 ? "text-orange" : "text-red"}>{d.avgScore}% avg</strong>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded bg-bg3">
                        <div
                          className={`h-full rounded ${d.avgScore >= 80 ? "bg-green" : d.avgScore >= 50 ? "bg-orange" : "bg-red"}`}
                          style={{ width: `${d.avgScore}%` }}
                        />
                      </div>
                      <div className="text-right text-[11px] text-t2">
                        {d.openFindings} Outstanding CAPA findings
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6S + 1S Pillar Averages */}
            <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
              <h3 className="mb-2.5 font-extrabold text-t1">Checklist Pillar Performance</h3>
              <div className="mt-2.5 grid gap-3">
                {pillarStats.map((p) => (
                  <div key={p.pillar} className="flex items-center gap-3">
                    <div className="w-10 text-[13px] font-bold">{p.pillar}</div>
                    <div className="flex-1">
                      <div className="mb-0.5 flex justify-between text-xs">
                        <span className="text-t2">{p.label}</span>
                        <strong>{p.avgScore}%</strong>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-bg3">
                        <div
                          className="h-full rounded-[3px] bg-brand"
                          style={{ width: `${p.avgScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <h3 className="mb-2.5 font-extrabold text-t1">Severity Heatmap - Department vs Severity</h3>
            {severityHeatmap.length === 0 ? (
              <div className="p-5 text-center text-t2">No findings recorded yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-bd bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department</th>
                      <th className="bg-bg3 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-t2">Critical</th>
                      <th className="bg-bg3 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-t2">High</th>
                      <th className="bg-bg3 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-t2">Medium</th>
                      <th className="bg-bg3 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-t2">Low</th>
                      <th className="bg-bg3 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-t2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {severityHeatmap.map((row) => (
                      <tr key={row.department}>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top font-semibold text-t1">{row.department}</td>
                        <td className={`border-b border-[#edf0f4] px-3 py-2.5 text-center align-top ${heatmapCellClass(row.Critical, "Critical")}`}>{row.Critical || "-"}</td>
                        <td className={`border-b border-[#edf0f4] px-3 py-2.5 text-center align-top ${heatmapCellClass(row.High, "High")}`}>{row.High || "-"}</td>
                        <td className={`border-b border-[#edf0f4] px-3 py-2.5 text-center align-top ${heatmapCellClass(row.Medium, "Medium")}`}>{row.Medium || "-"}</td>
                        <td className={`border-b border-[#edf0f4] px-3 py-2.5 text-center align-top ${heatmapCellClass(row.Low, "Low")}`}>{row.Low || "-"}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 text-center align-top font-bold text-t1">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: REPORTS & DATA EXPORTS TOOL */}
      {activeSubView === "exports" && (
        <div>
          {/* Controls filter sheet */}
          <div className="mb-5 rounded-lg border border-bd bg-bg1 p-[18px] shadow-[var(--shadow-sm)] print:hidden">
            <h3 className="mb-3.5 flex items-center gap-2 text-[15px] text-t1">
              <Filter size={16} /> Filters & Parameters
            </h3>

            <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Dataset Type</span>
                <select
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as any)}
                >
                  <option value="findings">Findings Log & CAPA Records</option>
                  <option value="audits">Audit Runs Summary</option>
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Department</span>
                <select
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  <option value="ALL">All Departments</option>
                  {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>

              {exportType === "findings" ? (
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Severity</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                  >
                    <option value="ALL">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
              ) : (
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Audit Status</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </label>
              )}

              {exportType === "findings" ? (
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Finding Status</span>
                  <select
                    className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">OPEN</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </label>
              ) : (
                <div />
              )}
            </div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_2fr]">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">From Date</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">To Date</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-3.5 py-2.5 text-sm font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-[0.55]"
                  onClick={downloadCSV}
                  disabled={filteredData.length === 0}
                >
                  <FileSpreadsheet size={15} /> Export CSV
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-[0.55]"
                  onClick={triggerPrint}
                  disabled={filteredData.length === 0}
                >
                  <Printer size={15} /> Print/PDF Report
                </button>
              </div>
            </div>
          </div>

          {/* Records grid preview */}
          <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
            <h3 className="mb-2.5 flex items-center justify-between font-extrabold text-t1 print:hidden">
              <span>Previewing Data ({filteredData.length} records matched)</span>
            </h3>

            {/* Print Header (Only visible in Print) */}
            <div className="mb-5 hidden border-b-2 border-black pb-2.5 print:block">
              <h1 className="mb-1 text-2xl">6S AuditPro System Report</h1>
              <p className="text-sm">
                Type: <strong>{exportType === "audits" ? "Audit Run Ledger" : "Findings & CAPA Non-Conformity Log"}</strong> |
                Generated on: {new Date().toLocaleString()}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg bg-white">
              {filteredData.length === 0 ? (
                <div className="p-[30px] text-center text-t2">No records match the current filters.</div>
              ) : exportType === "audits" ? (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Audit Number</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Auditor</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Date</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Zone</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Score</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((a) => (
                      <tr key={a._id}>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm"><strong>{a.auditNumber}</strong></td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{a.auditorName}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{a.date ? new Date(a.date).toLocaleDateString() : ""}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{a.department}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{a.zone}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm"><strong>{a.totalScore}%</strong></td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Finding ID</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Audit Ref</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Category</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Department / Zone</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Severity</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Due Date</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
                      <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Observation Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((f) => (
                      <tr key={f._id}>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm"><strong>{f.findingNumber}</strong></td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm"><span className="text-[11px] text-t2">{f.auditNumber || "Manual"}</span></td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{f.category}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{f.department} / {f.zone}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{f.severity}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "N/A"}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-sm">{f.status}</td>
                        <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-xs">{f.question}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
