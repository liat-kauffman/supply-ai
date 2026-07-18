import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { getDashboardData } from "@/lib/dashboard";
import { prisma } from "@supply/database";

export default async function DashboardPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [organization, dashboard] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    getDashboardData(organizationId),
  ]);
  return (
    <DashboardShell
      companyName={organization.name}
      dashboard={dashboard}
      userName={session.user.name}
    />
  );
}
