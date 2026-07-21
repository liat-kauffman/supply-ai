import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@supply/database";

import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function requireCompany() {
  const session = await requireSession();
  if (!session.session.activeOrganizationId) redirect("/onboarding/company");
  return { session, organizationId: session.session.activeOrganizationId };
}

export async function requireOnboardedCompany() {
  const company = await requireCompany();
  const profile = await prisma.businessProfile.findUnique({
    where: { id: company.organizationId },
    select: { onboardingCompletedAt: true },
  });
  if (!profile?.onboardingCompletedAt) redirect("/onboarding/setup");
  return company;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  const roles = session.user.role?.split(",").map((role) => role.trim()) ?? [];
  if (!roles.includes("super_admin")) redirect("/");
  return session;
}
