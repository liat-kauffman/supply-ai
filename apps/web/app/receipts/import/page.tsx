import { prisma } from "@supply/database";

import { BaseDataOnboarding } from "@/components/onboarding/base-data-onboarding";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";

export default async function ReceiptImportPage() {
  const { organizationId } = await requireOnboardedCompany();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });
  return (
    <BaseDataOnboarding
      companyName={displayText(organization.name, "Company")}
      existingSetup
    />
  );
}
