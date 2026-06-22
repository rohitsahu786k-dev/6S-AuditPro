import { AppShell } from "@/components/layout/AppShell";
import { EmailTemplateForm } from "@/components/admin/EmailTemplateForm";
import { EmailTemplateVariableHelper } from "@/components/admin/EmailTemplateVariableHelper";

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><div className="grid grid-2"><EmailTemplateForm id={id} /><EmailTemplateVariableHelper /></div></AppShell>;
}
