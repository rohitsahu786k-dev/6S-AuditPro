"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPatch, apiPost, useApi } from "@/hooks/useApi";
import { EMAIL_TRIGGER_LABELS } from "@/lib/constants";

type Template = {
  _id: string; templateKey: string; templateName: string; subject: string; htmlBody: string; textBody: string; triggerEvent: string; isActive: boolean;
};

export function EmailTemplateForm({ id }: { id?: string }) {
  const router = useRouter();
  const templates = useApi<Template[]>("/api/email/templates");
  const existing = templates.data?.find((template) => template._id === id);
  const [draft, setDraft] = useState<Partial<Template>>({});
  const model = { templateKey: "", templateName: "", subject: "", htmlBody: "", textBody: "", triggerEvent: "FINDING_ASSIGNED", isActive: true, ...(existing || {}), ...draft };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (id) await apiPatch(`/api/email/templates/${id}`, model);
    else await apiPost("/api/email/templates", model);
    router.push("/admin/email-templates");
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="page-title">{id ? "Edit Email Template" : "New Email Template"}</h1>
      <label className="field"><span className="label">Template Key</span><input className="control" value={model.templateKey} onChange={(e) => setDraft({ ...draft, templateKey: e.target.value })} /></label>
      <label className="field"><span className="label">Template Name</span><input className="control" value={model.templateName} onChange={(e) => setDraft({ ...draft, templateName: e.target.value })} /></label>
      <label className="field"><span className="label">Trigger Event</span><select className="control" value={model.triggerEvent} onChange={(e) => setDraft({ ...draft, triggerEvent: e.target.value })}>{Object.entries(EMAIL_TRIGGER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="field"><span className="label">Subject</span><input className="control" value={model.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
      <label className="field"><span className="label">HTML Body</span><textarea className="control" rows={8} value={model.htmlBody} onChange={(e) => setDraft({ ...draft, htmlBody: e.target.value })} /></label>
      <label className="field"><span className="label">Text Body</span><textarea className="control" rows={5} value={model.textBody} onChange={(e) => setDraft({ ...draft, textBody: e.target.value })} /></label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><input type="checkbox" checked={Boolean(model.isActive)} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>
      <button className="btn primary">Save Template</button>
    </form>
  );
}
