import { prisma } from "@supply/database";

import type {
  InventoryItem,
  InventoryStatus,
} from "@/components/inventory/inventory-data";
import { displayText, finiteNumber } from "@/lib/display";

const inventoryInclude = {
  movements: {
    orderBy: { occurredAt: "desc" as const },
    select: { quantityDelta: true, occurredAt: true },
  },
  supplierProducts: {
    orderBy: [{ isPreferred: "desc" as const }, { priority: "asc" as const }],
    take: 1,
    select: { supplier: { select: { name: true } } },
  },
};

type InventoryProduct = Awaited<ReturnType<typeof findProduct>>;

function statusFor(quantity: number, minimum: number): InventoryStatus {
  if (quantity <= 0) return "out";
  if (quantity < minimum) return "low";
  return "healthy";
}

function updatedLabel(date?: Date): string {
  if (!date) return "No count yet";
  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "Updated just now";
  if (elapsedMinutes < 60) return `Updated ${elapsedMinutes}m ago`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

function mapProduct(product: InventoryProduct): InventoryItem | null {
  if (!product) return null;
  const quantity = product.movements.reduce(
    (total, movement) => total + finiteNumber(movement.quantityDelta),
    0,
  );
  const minimum = finiteNumber(product.minimumStock);
  return {
    id: product.id,
    name: displayText(product.name, "Unnamed item"),
    description: displayText(product.description, "No description added yet."),
    category: displayText(product.category, "Uncategorized"),
    supplier: displayText(
      product.supplierProducts[0]?.supplier.name,
      "No supplier",
    ),
    quantity,
    unit: displayText(product.baseUnit, "units"),
    minimum,
    active: product.active,
    updated: updatedLabel(product.movements[0]?.occurredAt),
    status: statusFor(quantity, minimum),
  };
}

function findProduct(
  businessId: string,
  productId: string,
  options?: { includeInactive?: boolean },
) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
      ...(options?.includeInactive ? {} : { active: true }),
    },
    include: inventoryInclude,
  });
}

export async function getInventoryItem(
  businessId: string,
  productId: string,
  options?: { includeInactive?: boolean },
): Promise<InventoryItem | null> {
  return mapProduct(await findProduct(businessId, productId, options));
}

export async function getInventoryItems(
  businessId: string,
  options?: { includeInactive?: boolean },
): Promise<InventoryItem[]> {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      ...(options?.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: inventoryInclude,
  });
  return products
    .map((product) => mapProduct(product))
    .filter((item): item is InventoryItem => item !== null);
}
