import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CompanyOnboardingForm } from "@/components/auth/company-onboarding-form";
import { requireSession } from "@/lib/auth/server";

export default async function CompanyOnboardingPage() {
  const session = await requireSession();
  if (session.session.activeOrganizationId) redirect("/");
  return (
    <AuthShell
      title="Create your company"
      description="This workspace will contain your workers, inventory and audit history."
    >
      <CompanyOnboardingForm />
    </AuthShell>
  );
}
