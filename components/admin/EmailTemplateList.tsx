"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";

type Template = { _id: string; templateKey: string; templateName: string; triggerEvent: string; isActive: boolean; updatedAt?: string };

export function EmailTemplateList() {
  const templates = useApi<Template[]>("/api/email/templates");
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Email Templates</h1><p className="page-sub">Editable MongoDB-backed notification templates.</p></div><Link className="btn primary" href="/admin/email-templates/new">New Template</Link></div>
      <div className="table-wrap"><table><thead><tr><th>Name</th><th>Key</th><th>Trigger</th><th>Status</th><th /></tr></thead><tbody>{templates.data?.map((t) => <tr key={t._id}><td>{t.templateName}</td><td><code>{t.templateKey}</code></td><td>{t.triggerEvent}</td><td>{t.isActive ? "Active" : "Inactive"}</td><td><Link className="btn" href={`/admin/email-templates/${t._id}/edit`}>Edit</Link></td></tr>)}</tbody></table></div>
    </>
  );
}
