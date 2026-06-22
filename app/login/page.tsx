import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="login-page">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
