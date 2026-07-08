"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPatch, apiPost, useApi } from "@/hooks/useApi";
import { EMAIL_TRIGGER_LABELS } from "@/lib/constants";

type Template = {
  _id: string; templateKey: string; templateName: string; subject: string; htmlBody: string; textBody: string; triggerEvent: string; isActive: boolean;
};

const fieldClass = "grid gap-1.5 mb-3";
const labelClass = "text-[11px] font-extrabold uppercase tracking-wide text-t2";
const controlClass = "w-full rounded-lg border border-bd px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/12";

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
    <form className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]" onSubmit={submit}>
      <h1 className="mb-3 text-2xl font-extrabold text-t1">{id ? "Edit Email Template" : "New Email Template"}</h1>
      <label className={fieldClass}>
        <span className={labelClass}>Template Key</span>
        <input className={controlClass} value={model.templateKey} onChange={(e) => setDraft({ ...draft, templateKey: e.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>Template Name</span>
        <input className={controlClass} value={model.templateName} onChange={(e) => setDraft({ ...draft, templateName: e.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>Trigger Event</span>
        <select className={controlClass} value={model.triggerEvent} onChange={(e) => setDraft({ ...draft, triggerEvent: e.target.value })}>
          {Object.entries(EMAIL_TRIGGER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>Subject</span>
        <input className={controlClass} value={model.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>HTML Body</span>
        <textarea className={controlClass} rows={8} value={model.htmlBody} onChange={(e) => setDraft({ ...draft, htmlBody: e.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>Text Body</span>
        <textarea className={controlClass} rows={5} value={model.textBody} onChange={(e) => setDraft({ ...draft, textBody: e.target.value })} />
      </label>
      <label className="mb-3 flex items-center gap-2 text-sm text-t1">
        <input type="checkbox" checked={Boolean(model.isActive)} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active
      </label>
      <button className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d">
        Save Template
      </button>
    </form>
  );
}
