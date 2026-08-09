import { InventoryShell } from "@/components/inventory/inventory-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { getInventoryItems } from "@/lib/inventory";
import { prisma } from "@supply/database";

export default async function InventoryPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [items, organization, storageAreas] = await Promise.all([
    getInventoryItems(organizationId, { includeInactive: true }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.storageArea.findMany({
      where: { location: { businessId: organizationId }, active: true },
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, location: { select: { name: true } } },
    }),
  ]);
  return (
    <InventoryShell
      companyName={displayText(organization.name, "Company")}
      initialItems={items}
      storageAreas={storageAreas}
      userName={displayText(session.user.name, "User")}
    />
  );
}
