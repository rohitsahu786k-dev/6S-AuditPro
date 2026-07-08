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
  const auditsApi = useApi<Audit[]>("/api/audits");
  const findingsApi = useApi<Finding[]>("/api/findings");

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
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">Analytics & Compliance Insights</h1>
          <p className="page-sub">Monitor key aggregate trends, category-wise breakdowns, and export print-ready tabular sheets.</p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button 
            className={`btn ${activeSubView === "dashboard" ? "primary" : ""}`}
            onClick={() => setActiveSubView("dashboard")}
          >
            <BarChart3 size={16} /> Dashboards
          </button>
          <button 
            className={`btn ${activeSubView === "exports" ? "primary" : ""}`}
            onClick={() => setActiveSubView("exports")}
          >
            <Printer size={16} /> Reports & Exports
          </button>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE DASHBOARD */}
      {activeSubView === "dashboard" && (
        <div className="no-print">
          {/* Live Counters */}
          <div className="grid grid-5" style={{ marginBottom: "24px" }}>
            <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", background: "#f1f5f9", borderRadius: "8px", color: "var(--text)" }}>
                <Layers size={20} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px", textTransform: "uppercase" }}>Total Logged</div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counters.total}</div>
              </div>
            </div>

            <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", background: "#fffbeb", borderRadius: "8px", color: "#b45309" }}>
                <Clock size={20} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px", textTransform: "uppercase" }}>Open & Active</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#b45309" }}>{counters.open}</div>
              </div>
            </div>

            <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", background: "#e0f2fe", borderRadius: "8px", color: "#0369a1" }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px", textTransform: "uppercase" }}>CAPA Review</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0369a1" }}>{counters.submitted}</div>
              </div>
            </div>

            <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", background: "#fee2e2", borderRadius: "8px", color: "#b91c1c" }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px", textTransform: "uppercase" }}>Overdue Findings</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#b91c1c" }}>{counters.overdue}</div>
              </div>
            </div>

            <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ padding: "10px", background: "#f0fdf4", borderRadius: "8px", color: "#15803d" }}>
                <CheckCircle size={20} />
              </div>
              <div>
                <div className="muted" style={{ fontSize: "11px", textTransform: "uppercase" }}>Resolved / Closed</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#15803d" }}>{counters.closed}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: "24px", marginBottom: "24px" }}>
            {/* Department Performance */}
            <div className="card">
              <h3 className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Department Audit Scores</span>
                <span className="muted" style={{ fontSize: "11px" }}>Active Averages</span>
              </h3>
              <div style={{ display: "grid", gap: "14px", marginTop: "10px" }}>
                {departmentStats.length === 0 ? (
                  <div className="muted" style={{ textAlign: "center", padding: "20px" }}>No audit score data found.</div>
                ) : (
                  departmentStats.map((d) => (
                    <div key={d.department} style={{ display: "grid", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ fontWeight: 600 }}>{d.department}</span>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <span className="muted">{d.auditCount} Audits</span>
                          <strong style={{ color: d.avgScore >= 80 ? "var(--ok)" : d.avgScore >= 50 ? "#c2410c" : "var(--danger)" }}>{d.avgScore}% avg</strong>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div 
                          style={{ 
                            width: `${d.avgScore}%`, 
                            height: "100%", 
                            borderRadius: "4px",
                            background: d.avgScore >= 80 ? "var(--ok)" : d.avgScore >= 50 ? "#f59e0b" : "var(--danger)"
                          }} 
                        />
                      </div>
                      <div className="muted" style={{ fontSize: "11px", textAlign: "right" }}>
                        {d.openFindings} Outstanding CAPA findings
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6S + 1S Pillar Averages */}
            <div className="card">
              <h3 className="card-title">Checklist Pillar Performance</h3>
              <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                {pillarStats.map((p) => (
                  <div key={p.pillar} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "40px", fontWeight: "bold", fontSize: "13px" }}>{p.pillar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "2px" }}>
                        <span className="muted">{p.label}</span>
                        <strong>{p.avgScore}%</strong>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div 
                          style={{ 
                            width: `${p.avgScore}%`, 
                            height: "100%", 
                            background: "var(--brand)", 
                            borderRadius: "3px" 
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: REPORTS & DATA EXPORTS TOOL */}
      {activeSubView === "exports" && (
        <div>
          {/* Controls filter sheet */}
          <div className="card no-print" style={{ padding: "18px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
              <Filter size={16} /> Filters & Parameters
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Dataset Type</span>
                <select className="control" value={exportType} onChange={(e) => setExportType(e.target.value as any)}>
                  <option value="findings">Findings Log & CAPA Records</option>
                  <option value="audits">Audit Runs Summary</option>
                </select>
              </label>

              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Department</span>
                <select className="control" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                  <option value="ALL">All Departments</option>
                  {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>

              {exportType === "findings" ? (
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Severity</span>
                  <select className="control" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                    <option value="ALL">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
              ) : (
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Audit Status</span>
                  <select className="control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="ALL">All Statuses</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </label>
              )}

              {exportType === "findings" ? (
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Finding Status</span>
                  <select className="control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "12px", alignItems: "end" }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">From Date</span>
                <input type="date" className="control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>

              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">To Date</span>
                <input type="date" className="control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button className="btn" onClick={downloadCSV} disabled={filteredData.length === 0}>
                  <FileSpreadsheet size={15} /> Export CSV
                </button>
                <button className="btn primary" onClick={triggerPrint} disabled={filteredData.length === 0}>
                  <Printer size={15} /> Print/PDF Report
                </button>
              </div>
            </div>
          </div>

          {/* Records grid preview */}
          <div className="card">
            <h3 className="card-title no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Previewing Data ({filteredData.length} records matched)</span>
            </h3>

            {/* Print Header (Only visible in Print) */}
            <div className="only-print" style={{ marginBottom: "20px", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
              <h1 style={{ margin: "0 0 4px", fontSize: "24px" }}>6S AuditPro System Report</h1>
              <p style={{ margin: 0, fontSize: "14px" }}>
                Type: <strong>{exportType === "audits" ? "Audit Run Ledger" : "Findings & CAPA Non-Conformity Log"}</strong> | 
                Generated on: {new Date().toLocaleString()}
              </p>
            </div>

            <div className="table-wrap" style={{ border: 0 }}>
              {filteredData.length === 0 ? (
                <div className="muted" style={{ padding: "30px", textAlign: "center" }}>No records match the current filters.</div>
              ) : exportType === "audits" ? (
                <table>
                  <thead>
                    <tr>
                      <th>Audit Number</th>
                      <th>Auditor</th>
                      <th>Date</th>
                      <th>Department</th>
                      <th>Zone</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((a) => (
                      <tr key={a._id}>
                        <td><strong>{a.auditNumber}</strong></td>
                        <td>{a.auditorName}</td>
                        <td>{a.date ? new Date(a.date).toLocaleDateString() : ""}</td>
                        <td>{a.department}</td>
                        <td>{a.zone}</td>
                        <td><strong>{a.totalScore}%</strong></td>
                        <td>{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Finding ID</th>
                      <th>Audit Ref</th>
                      <th>Category</th>
                      <th>Department / Zone</th>
                      <th>Severity</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Observation Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((f) => (
                      <tr key={f._id}>
                        <td><strong>{f.findingNumber}</strong></td>
                        <td><span className="muted" style={{ fontSize: "11px" }}>{f.auditNumber || "Manual"}</span></td>
                        <td>{f.category}</td>
                        <td>{f.department} / {f.zone}</td>
                        <td>{f.severity}</td>
                        <td>{f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "N/A"}</td>
                        <td>{f.status}</td>
                        <td style={{ fontSize: "12px" }}>{f.question}</td>
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
