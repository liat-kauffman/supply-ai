import { InventoryShell } from "@/components/inventory/inventory-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText } from "@/lib/display";
import { getInventoryItems } from "@/lib/inventory";
import { prisma } from "@supply/database";

type PendingAreaScan = {
  id: string;
  createdAt: string;
  createdByName: string;
  storageAreaName: string | null;
  observations: Array<{
    productId: string;
    name: string;
    count: number;
    confidence: number;
  }>;
  globalWarnings: string[];
};

export default async function InventoryPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [items, organization, storageAreas, membership, scans] =
    await Promise.all([
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
      prisma.member.findUniqueOrThrow({
        where: {
          organizationId_userId: {
            organizationId,
            userId: session.user.id,
          },
        },
        select: { role: true },
      }),
      prisma.inventoryScan.findMany({
        where: { businessId: organizationId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          observations: true,
          globalWarnings: true,
          createdBy: { select: { name: true } },
          storageArea: { select: { name: true } },
        },
      }),
    ]);
  const pendingScans: PendingAreaScan[] = scans.map((scan) => ({
    id: scan.id,
    createdAt: scan.createdAt.toISOString(),
    createdByName: displayText(scan.createdBy.name, "Team member"),
    storageAreaName: scan.storageArea?.name ?? null,
    observations: scan.observations as PendingAreaScan["observations"],
    globalWarnings: scan.globalWarnings as string[],
  }));
  return (
    <InventoryShell
      companyName={displayText(organization.name, "Company")}
      currentRole={membership.role}
      initialItems={items}
      storageAreas={storageAreas}
      pendingScans={pendingScans}
      userName={displayText(session.user.name, "User")}
    />
  );
}
