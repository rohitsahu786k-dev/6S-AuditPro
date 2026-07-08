import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff1f1] via-[#f0f4f8] to-[#fff7f7] p-5">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
