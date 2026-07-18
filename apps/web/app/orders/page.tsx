import { prisma } from "@supply/database";

import { OrdersShell } from "@/components/orders/orders-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { getOrdersData } from "@/lib/orders";

export default async function OrdersPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [organization, orders] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    getOrdersData(organizationId),
  ]);

  return (
    <OrdersShell
      companyName={displayText(organization.name, "Company")}
      orders={orders}
      userName={displayText(session.user.name, "User")}
    />
  );
}
