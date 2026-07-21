import { prisma } from "@supply/database";

import { OrdersShell } from "@/components/orders/orders-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { getOrderApprovalRequests, getOrdersData } from "@/lib/orders";

export default async function OrdersPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const membership = await prisma.member.findUniqueOrThrow({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  const [organization, orders, approvalRequests] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    getOrdersData(organizationId),
    getOrderApprovalRequests(organizationId, session.user.id, membership.role),
  ]);

  return (
    <OrdersShell
      companyName={displayText(organization.name, "Company")}
      approvalRequests={approvalRequests}
      currentRole={membership.role}
      orders={orders}
      userName={displayText(session.user.name, "User")}
    />
  );
}
