import { prisma } from "@supply/database";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export class ApiAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function requireApiCompany(allowedRoles?: string[]) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ApiAccessError("Sign in is required", 401);

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId)
    throw new ApiAccessError("Choose a company before continuing", 403);

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  if (!membership)
    throw new ApiAccessError("You do not belong to this company", 403);
  if (allowedRoles && !allowedRoles.includes(membership.role))
    throw new ApiAccessError("You do not have permission for this change", 403);

  return {
    organizationId,
    userId: session.user.id,
    role: membership.role,
  };
}
