import { prisma } from "@supply/database";
import { redirect } from "next/navigation";

import { BaseDataOnboarding } from "@/components/onboarding/base-data-onboarding";
import { requireCompany } from "@/lib/auth/server";

export default async function BaseDataOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const { organizationId } = await requireCompany();
  const addingReceipts = (await searchParams).add === "receipts";
  const profile = await prisma.businessProfile.findUnique({
    where: { id: organizationId },
    select: {
      onboardingCompletedAt: true,
      organization: { select: { name: true } },
    },
  });
  if (profile?.onboardingCompletedAt && addingReceipts)
    redirect("/receipts/import");
  if (profile?.onboardingCompletedAt && !addingReceipts) redirect("/");

  return (
    <BaseDataOnboarding
      companyName={profile?.organization.name ?? "Your company"}
      existingSetup={Boolean(profile?.onboardingCompletedAt)}
    />
  );
}
