import { EMAIL_VARIABLES } from "@/lib/constants";

export function EmailTemplateVariableHelper() {
  return (
    <div className="card">
      <h2 className="card-title">Supported Variables</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EMAIL_VARIABLES.map((v) => <code className="badge" key={v}>{`{{${v}}}`}</code>)}
      </div>
    </div>
  );
}
