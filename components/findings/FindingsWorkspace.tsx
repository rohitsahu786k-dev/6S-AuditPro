"use client";

import { useState } from "react";
import { apiPost, useApi } from "@/hooks/useApi";

type Finding = { _id: string; findingNumber: string; department: string; zone: string; category: string; severity: string; status: string; question: string; dueDate?: string };

export function FindingsWorkspace() {
  const findings = useApi<Finding[]>("/api/findings");
  const [note, setNote] = useState("");

  async function submitCapa(id: string) {
    await apiPost(`/api/findings/${id}/capa`, { capaAction: "Corrective action completed and evidence uploaded.", closureRemarks: "Submitted for auditor review.", afterPhotos: [] });
    setNote("CAPA submitted.");
    await findings.reload();
  }

  async function review(id: string, decision: "approve" | "reject" | "reopen") {
    await apiPost(`/api/findings/${id}/review`, { decision, remarks: decision === "approve" ? "Closure approved" : "Please revise evidence", rejectionReason: decision === "reject" ? "Evidence is insufficient" : undefined });
    setNote(`Review ${decision} saved.`);
    await findings.reload();
  }

  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Findings & CAPA</h1><p className="page-sub">Department actions, closure submission, and auditor review workflow.</p></div></div>
      {note ? <div className="alert">{note}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Finding</th><th>Area</th><th>Category</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {findings.data?.map((f) => (
              <tr key={f._id}>
                <td><strong>{f.findingNumber}</strong><br /><span className="muted">{f.question}</span></td>
                <td>{f.department}<br /><span className="muted">{f.zone}</span></td>
                <td>{f.category}</td>
                <td><span className="badge">{f.severity}</span></td>
                <td>{f.status}</td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => submitCapa(f._id)}>Submit CAPA</button>
                  <button className="btn primary" onClick={() => review(f._id, "approve")}>Approve</button>
                  <button className="btn danger" onClick={() => review(f._id, "reject")}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
