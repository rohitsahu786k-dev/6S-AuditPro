import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff1f1] via-[#f0f4f8] to-[#fff7f7] p-5">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
