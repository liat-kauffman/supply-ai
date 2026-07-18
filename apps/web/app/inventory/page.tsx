import { InventoryShell } from "@/components/inventory/inventory-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { getInventoryItems } from "@/lib/inventory";
import { prisma } from "@supply/database";

export default async function InventoryPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [items, organization] = await Promise.all([
    getInventoryItems(organizationId, { includeInactive: true }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
  ]);
  return (
    <InventoryShell
      companyName={organization.name}
      initialItems={items}
      userName={session.user.name}
    />
  );
}
