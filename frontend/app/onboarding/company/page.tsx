import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { CompanyOnboardingForm } from "@/components/auth/company-onboarding-form";
import { ExistingOrganizationRedirect } from "@/components/auth/existing-organization-redirect";
import { prisma } from "@supply/database";
import { requireSession } from "@/lib/auth/server";

export default async function CompanyOnboardingPage() {
  const session = await requireSession();
  if (session.session.activeOrganizationId) redirect("/");

  const memberships = await prisma.member.findMany({
    where: { userId: session.user.id },
    select: {
      organizationId: true,
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (memberships[0]) {
    return (
      <ExistingOrganizationRedirect
        organizationId={memberships[0].organizationId}
        organizationName={memberships[0].organization.name}
      />
    );
  }

  return (
    <AuthShell
      title="Create your company"
      description="This workspace will contain your workers, inventory and audit history."
    >
      <CompanyOnboardingForm />
    </AuthShell>
  );
}
