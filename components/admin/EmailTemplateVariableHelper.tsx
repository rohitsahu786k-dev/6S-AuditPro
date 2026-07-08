import { EMAIL_VARIABLES } from "@/lib/constants";

export function EmailTemplateVariableHelper() {
  return (
    <div className="rounded-lg border border-bd bg-bg1 p-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-2.5 font-extrabold text-t1">Supported Variables</h2>
      <div className="flex flex-wrap gap-1.5">
        {EMAIL_VARIABLES.map((v) => (
          <code key={v} className="inline-flex items-center rounded-full border border-red-200 bg-accent px-2.5 py-0.5 text-xs font-extrabold text-brand-d">{`{{${v}}}`}</code>
        ))}
      </div>
    </div>
  );
}
