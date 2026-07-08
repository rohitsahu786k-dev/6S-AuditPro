import { AppShell } from "@/components/layout/AppShell";
import { EmailTemplateForm } from "@/components/admin/EmailTemplateForm";
import { EmailTemplateVariableHelper } from "@/components/admin/EmailTemplateVariableHelper";

export default function NewEmailTemplatePage() {
  return <AppShell><div className="grid grid-cols-1 gap-5 md:grid-cols-2"><EmailTemplateForm /><EmailTemplateVariableHelper /></div></AppShell>;
}
