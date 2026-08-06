import { prisma } from "@supply/database";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { organizationRoles, type CompanyRole } from "@/lib/auth/permissions";

export class ApiAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function requireApiCompany(allowedRoles?: CompanyRole[]) {
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
  const role = membership.role as CompanyRole;
  if (!Object.hasOwn(organizationRoles, role))
    throw new ApiAccessError("Your company role is invalid", 403);
  if (allowedRoles && !allowedRoles.includes(role))
    throw new ApiAccessError("You do not have permission for this change", 403);

  return {
    organizationId,
    userId: session.user.id,
    role,
  };
}

export function apiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiAccessError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error(error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
