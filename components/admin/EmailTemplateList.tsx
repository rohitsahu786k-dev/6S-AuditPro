"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";

type Template = { _id: string; templateKey: string; templateName: string; triggerEvent: string; isActive: boolean; updatedAt?: string };

export function EmailTemplateList() {
  const templates = useApi<Template[]>("/api/email/templates");
  return (
    <>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">Email Templates</h1>
          <p className="mt-1 text-sm text-t2">Editable MongoDB-backed notification templates.</p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3.5 py-2.5 text-sm font-bold text-white hover:bg-brand-d"
          href="/admin/email-templates/new"
        >
          New Template
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-bd bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Name</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Key</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Trigger</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2">Status</th>
              <th className="bg-bg3 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-t2" />
            </tr>
          </thead>
          <tbody>
            {templates.data?.map((t) => (
              <tr key={t._id}>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{t.templateName}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                  <code>{t.templateKey}</code>
                </td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{t.triggerEvent}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">{t.isActive ? "Active" : "Inactive"}</td>
                <td className="border-b border-[#edf0f4] px-3 py-2.5 align-top">
                  <Link
                    className="inline-flex items-center gap-2 rounded-lg border border-bd bg-white px-2.5 py-1.5 text-xs font-bold text-t1 hover:bg-bg3"
                    href={`/admin/email-templates/${t._id}/edit`}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
