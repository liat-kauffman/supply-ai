import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Register your company"
      description="First create the owner account. Company details come next."
    >
      <RegisterForm />
    </AuthShell>
  );
}
