import { SignupForm } from "@/components/auth/SignupForm";
import { redirect } from "next/navigation";

export default function SignupPage() {
  if (process.env.ALLOW_PUBLIC_SIGNUP !== "true") redirect("/login");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff1f1] via-[#f0f4f8] to-[#fff7f7] p-5">
      <SignupForm />
    </div>
  );
}
