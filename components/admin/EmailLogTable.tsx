"use client";

import { useApi } from "@/hooks/useApi";

type Log = { _id: string; templateKey?: string; triggerEvent?: string; recipients: string[]; subject?: string; status: string; errorMessage?: string; createdAt: string };

export function EmailLogTable() {
  const logs = useApi<Log[]>("/api/email/logs");
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Email Logs</h1><p className="page-sub">Sent, failed, and skipped email delivery records.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>When</th><th>Template</th><th>Recipients</th><th>Status</th><th>Error</th></tr></thead><tbody>{logs.data?.map((l) => <tr key={l._id}><td>{new Date(l.createdAt).toLocaleString()}</td><td>{l.templateKey || l.triggerEvent}</td><td>{l.recipients?.join(", ")}</td><td><span className="badge">{l.status}</span></td><td>{l.errorMessage}</td></tr>)}</tbody></table></div>
    </>
  );
}
