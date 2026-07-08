"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Search, FileSpreadsheet } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";

type ChecklistItem = {
  questionId: string;
  category: string;
  question: string;
  response: "Adequate" | "Not Adequate" | "N/A";
  observation?: string;
  severity?: "Critical" | "High" | "Medium" | "Low";
};

type Audit = {
  _id: string;
  auditNumber: string;
  department: string;
  zone: string;
  date: string;
  status: string;
  checklist: ChecklistItem[];
};

type Finding = {
  _id: string;
  auditId?: string;
  questionId: string;
  status: string;
  dueDate?: string;
  updatedAt?: string;
};

type RegisterRow = {
  key: string;
  auditNumber: string;
  date: string;
  department: string;
  zone: string;
  category: string;
  question: string;
  response: ChecklistItem["response"];
  severity?: string;
  observation?: string;
  status: string;
  dueOrClosed?: string;
};

const PAGE_SIZE = 25;

function statusClass(status: string) {
  if (status === "CLOSED") return "border-green-200 bg-green-50 text-green";
  if (status === "OK") return "border-green-200 bg-green-50 text-green";
  if (status === "N/A") return "border-slate-200 bg-slate-50 text-t2";
  if (status === "SUBMITTED" || status === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-orange";
  return "border-red-200 bg-accent text-brand-d";
}

export function RegisterWorkspace() {
  const auditsApi = useApi<Audit[]>("/api/audits?view=register");
  const findingsApi = useApi<Finding[]>("/api/findings?view=register");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo<RegisterRow[]>(() => {
    const audits = auditsApi.data || [];
    const findings = findingsApi.data || [];
    const out: RegisterRow[] = [];
    for (const audit of audits) {
      for (const item of audit.checklist || []) {
        const match = findings.find((f) => f.auditId === audit._id && f.questionId === item.questionId);
        const status = item.response === "Not Adequate" ? match?.status || "OPEN" : item.response === "N/A" ? "N/A" : "OK";
        const dueOrClosed = match ? (match.status === "CLOSED" ? match.updatedAt : match.dueDate) : undefined;
        out.push({
          key: `${audit._id}-${item.questionId}`,
          auditNumber: audit.auditNumber,
          date: audit.date,
          department: audit.department,
          zone: audit.zone,
          category: item.category,
          question: item.question,
          response: item.response,
          severity: item.severity,
          observation: item.observation,
          status,
          dueOrClosed
        });
      }
    }
    return out.sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime());
  }, [auditsApi.data, findingsApi.data]);

  const uniqueDepts = useMemo(() => Array.from(new Set(rows.map((r) => r.department))), [rows]);
  const uniqueZones = useMemo(() => Array.from(new Set(rows.map((r) => r.zone))), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !search ||
        r.question.toLowerCase().includes(search.toLowerCase()) ||
        r.auditNumber.toLowerCase().includes(search.toLowerCase()) ||
        (r.observation || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      const matchSeverity = severityFilter === "ALL" || r.severity === severityFilter;
      const matchDept = deptFilter === "ALL" || r.department === deptFilter;
      const matchCategory = categoryFilter === "ALL" || r.category === categoryFilter;
      const matchStart = !startDate || new Date(r.date) >= new Date(startDate);
      const matchEnd = !endDate || new Date(r.date) <= new Date(endDate);
      return matchSearch && matchStatus && matchSeverity && matchDept && matchCategory && matchStart && matchEnd;
    });
  }, [rows, search, statusFilter, severityFilter, deptFilter, categoryFilter, startDate, endDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function downloadCSV() {
    const headers = ["Audit No", "Date", "Department", "Zone", "Category", "Question", "Response", "Severity", "Observation", "Status", "Due/Closed"];
    const csvRows = filtered.map((r) => [
      r.auditNumber,
      r.date ? new Date(r.date).toLocaleDateString() : "",
      r.department,
      r.zone,
      r.category,
      `"${r.question.replace(/"/g, '""')}"`,
      r.response,
      r.severity || "",
      `"${(r.observation || "").replace(/"/g, '""')}"`,
      r.status,
      r.dueOrClosed ? new Date(r.dueOrClosed).toLocaleDateString() : ""
    ]);
    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `6S_Findings_Register_${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const loading = auditsApi.loading || findingsApi.loading;

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Findings Register</h1>
          <p className="mt-1 text-sm text-t2">{filtered.length} records - every checklist item logged across all audits.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-[0.55]"
          onClick={downloadCSV}
          disabled={filtered.length === 0}
        >
          <FileSpreadsheet size={15} /> Export CSV
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Search</span>
            <Search size={14} className="pointer-events-none absolute top-[34px] left-3 text-t3" />
            <input
              className="w-full rounded-lg border border-bd py-2.5 pr-3 pl-8 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12"
              placeholder="Question, observation, audit no..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Status</span>
            <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All Statuses</option>
              <option value="OK">OK (Adequate)</option>
              <option value="N/A">N/A</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="REOPENED">REOPENED</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Severity</span>
            <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Category</span>
            <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">Department</span>
            <select className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All Departments</option>
              {uniqueDepts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">From Date</span>
            <input type="date" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-t2">To Date</span>
            <input type="date" className="w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </label>
          {uniqueZones.length > 0 ? <div /> : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-bd bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">#</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Audit No</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Date</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Dept</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Zone</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Category</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Question</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Response</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Severity</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Observation</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Due/Closed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-t2">Loading register...</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-t2">No records match the current filters.</td></tr>
            ) : (
              pageRows.map((r, index) => (
                <tr key={r.key}>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top text-t2">{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top font-semibold text-brand">{r.auditNumber}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{r.date ? new Date(r.date).toLocaleDateString() : ""}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{r.department}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{r.zone}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <span className="inline-flex items-center rounded-md border border-bd bg-bg3 px-1.5 py-0.5 text-[11px] font-semibold text-t2">{r.category}</span>
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top max-w-[260px] line-clamp-2" title={r.question}>{r.question}</td>
                  <td
                    className={`border-b border-[#edf0f4] px-3 py-2.5 align-top font-semibold ${
                      r.response === "Not Adequate" ? "text-red" : r.response === "Adequate" ? "text-green" : "text-t2"
                    }`}
                  >
                    {r.response}
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    {r.severity ? (
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-accent px-2 py-0.5 text-[11px] font-extrabold text-brand-d">{r.severity}</span>
                    ) : (
                      <span className="text-t3">-</span>
                    )}
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top max-w-[220px] line-clamp-2 text-t2" title={r.observation}>{r.observation || "-"}</td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                    <span
                      className={`inline-flex min-w-[74px] items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${statusClass(r.status)}`}
                    >
                      {r.status || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{r.dueOrClosed ? new Date(r.dueOrClosed).toLocaleDateString() : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-t2">
          <div>
            {filtered.length} records | Page {page} of {pageCount}
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-3 py-1.5 text-sm font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-bd bg-white px-3 py-1.5 text-sm font-bold text-t1 hover:bg-bg3 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
