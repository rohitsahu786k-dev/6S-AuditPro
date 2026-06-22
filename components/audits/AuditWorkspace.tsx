"use client";

import { useMemo, useState } from "react";
import { apiPost, useApi } from "@/hooks/useApi";
import { CATEGORIES } from "@/lib/constants";

type Masters = { zones: Array<{ name: string; department: string }>; questions: Array<{ _id: string; category: string; text: string }> };
type Audit = { _id: string; auditNumber: string; zone: string; department: string; auditorName: string; totalScore: number; date: string };

export function AuditWorkspace() {
  const masters = useApi<Masters>("/api/masters");
  const audits = useApi<Audit[]>("/api/audits");
  const [zone, setZone] = useState("");
  const [message, setMessage] = useState("");
  const selectedZone = masters.data?.zones.find((z) => z.name === zone);
  const questions = useMemo(() => masters.data?.questions.filter((q) => q.category === CATEGORIES[0]) || [], [masters.data]);

  async function createSampleAudit() {
    if (!selectedZone || !masters.data) return setMessage("Select a zone first.");
    const checklist = masters.data.questions.map((q, index) => ({
      questionId: q._id,
      category: q.category,
      question: q.text,
      response: index % 5 === 0 ? "Not Adequate" : "Adequate",
      observation: index % 5 === 0 ? "Action required during audit verification" : ""
    }));
    await apiPost("/api/audits", { zone: selectedZone.name, department: selectedZone.department, auditorName: "Lead Auditor", checklist });
    setMessage("Audit created with findings for non-adequate items.");
    await audits.reload();
  }

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Audits</h1><p className="page-sub">Create audits, score checklist responses, and generate findings.</p></div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h2 className="card-title">New 6S Audit</h2>
          {message ? <div className="alert">{message}</div> : null}
          <label className="field"><span className="label">Zone</span><select className="control" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">Select zone</option>{masters.data?.zones.map((z) => <option key={z.name}>{z.name}</option>)}</select></label>
          <p className="muted">{selectedZone ? `Department: ${selectedZone.department}` : "Seed masters to load zones and questions."}</p>
          <button className="btn primary" onClick={createSampleAudit} disabled={!selectedZone}>Create Audit</button>
          <p className="muted" style={{ fontSize: 12 }}>First category preview: {questions.length} questions. Full checklist is stored category-wise in MongoDB.</p>
        </div>
        <div className="card">
          <h2 className="card-title">Audit History</h2>
          <div className="table-wrap"><table><thead><tr><th>No.</th><th>Zone</th><th>Department</th><th>Score</th></tr></thead><tbody>{audits.data?.map((a) => <tr key={a._id}><td>{a.auditNumber}</td><td>{a.zone}</td><td>{a.department}</td><td>{a.totalScore}%</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </>
  );
}
