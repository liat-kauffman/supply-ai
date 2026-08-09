import { AccountShell } from "@/components/dashboard/account-shell";
import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { getAnalyticsData } from "@/lib/analytics";
import { displayText } from "@/lib/display";
import { prisma } from "@supply/database";

export default async function AnalyticsPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [organization, analytics] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    getAnalyticsData(organizationId),
  ]);

  return (
    <AccountShell
      title="Analytics"
      subtitle="Understand spend, purchasing activity, and operating coverage over time."
      companyName={displayText(organization.name, "Company")}
      userName={displayText(session.user.name, "User")}
    >
      <AnalyticsPanel analytics={analytics} />
    </AccountShell>
  );
}
