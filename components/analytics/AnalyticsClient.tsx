"use client";

import { useMemo } from "react";
import { useApi } from "@/hooks/useApi";

type Audit = { department: string; totalScore: number };
type Finding = { department: string; severity: string; status: string };

export function AnalyticsClient() {
  const audits = useApi<Audit[]>("/api/audits");
  const findings = useApi<Finding[]>("/api/findings");
  const departmentScores = useMemo(() => {
    const grouped = new Map<string, number[]>();
    for (const audit of audits.data || []) grouped.set(audit.department, [...(grouped.get(audit.department) || []), audit.totalScore || 0]);
    return [...grouped.entries()].map(([department, scores]) => ({ department, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) })).sort((a, b) => b.score - a.score);
  }, [audits.data]);
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Analytics & Insights</h1><p className="page-sub">Score ranking, closure load, and severity concentration.</p></div></div>
      <div className="grid grid-2">
        <div className="card"><h2 className="card-title">Department Score Ranking</h2>{departmentScores.map((r) => <p key={r.department}><strong>{r.department}</strong> <span className="badge">{r.score}%</span></p>) || null}</div>
        <div className="card"><h2 className="card-title">Severity Heatmap Data</h2><div className="table-wrap"><table><tbody>{(findings.data || []).map((f, i) => <tr key={i}><td>{f.department}</td><td>{f.severity}</td><td>{f.status}</td></tr>)}</tbody></table></div></div>
      </div>
    </>
  );
}
