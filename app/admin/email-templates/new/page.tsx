import { AppShell } from "@/components/layout/AppShell";
import { EmailTemplateForm } from "@/components/admin/EmailTemplateForm";
import { EmailTemplateVariableHelper } from "@/components/admin/EmailTemplateVariableHelper";

export default function NewEmailTemplatePage() {
  return <AppShell><div className="grid grid-2"><EmailTemplateForm /><EmailTemplateVariableHelper /></div></AppShell>;
}
