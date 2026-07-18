import { prisma } from "@supply/database";

import { displayText, finiteNumber, finiteNumberOrNull } from "@/lib/display";

export interface OrderBasketItem {
  productId: string;
  productName: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  shortageQuantity: number;
  usageSinceLastReceipt: number;
  recommendedQuantity: number;
  unitsPerPackage: number;
  packageCount: number;
  latestPackagePrice: number | null;
  estimatedCost: number | null;
  supplierSku: string | null;
  lastReceiptDate: string | null;
  lastReceiptQuantity: number | null;
}

export interface SupplierBasket {
  supplierId: string;
  supplierName: string;
  logo: string;
  currency: string;
  cutoffLabel: string;
  deliveryLabel: string;
  minimumValue: number;
  basketValue: number;
  remainingValue: number;
  itemCount: number;
  items: OrderBasketItem[];
}

export interface OrdersData {
  currency: string;
  summary: {
    supplierCount: number;
    itemCount: number;
    basketValue: number;
    criticalCount: number;
  };
  baskets: SupplierBasket[];
}

export interface OrderApprovalLine {
  id: string;
  productId: string;
  productName: string;
  supplierSku: string | null;
  unit: string;
  requestedQuantity: number;
  unitsPerPackage: number;
  packageCount: number;
  latestPackagePrice: number | null;
  estimatedCost: number | null;
}

export interface OrderApprovalRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  supplierId: string;
  supplierName: string;
  currency: string;
  note: string | null;
  requesterName: string;
  reviewerName: string | null;
  createdAt: string;
  reviewedAt: string | null;
  lines: OrderApprovalLine[];
}

function currentQuantity(movements: Array<{ quantityDelta: unknown }>) {
  return movements.reduce(
    (total, movement) => total + finiteNumber(movement.quantityDelta),
    0,
  );
}

function currentMinimum(value: unknown) {
  return finiteNumber(value);
}

function getWeekdayIndex(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function getTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  return { hour, minute };
}

function daysUntilOrder(orderDays: number[], today: number) {
  if (!orderDays.length) return null;
  return Math.min(...orderDays.map((day) => (day - today + 7) % 7));
}

function cutoffLabel(
  cutoffTime: string | null,
  isToday: boolean,
  timeZone: string,
  now: Date,
) {
  if (!cutoffTime) return isToday ? "Today" : "No cutoff time";
  if (!isToday) return cutoffTime;
  const [hourText, minuteText] = cutoffTime.split(":");
  const cutoffMinutes = Number(hourText) * 60 + Number(minuteText);
  const current = getTimeParts(now, timeZone);
  const currentMinutes = current.hour * 60 + current.minute;
  const remaining = cutoffMinutes - currentMinutes;
  if (remaining <= 0) return "Closed";
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  if (!hours) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function receiptDateLabel(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export async function getOrdersData(
  organizationId: string,
): Promise<OrdersData> {
  const now = new Date();

  const [profile, products] = await Promise.all([
    prisma.businessProfile.findUnique({
      where: { id: organizationId },
      select: { timezone: true, currency: true },
    }),
    prisma.product.findMany({
      where: { businessId: organizationId, active: true },
      orderBy: { name: "asc" },
      include: {
        movements: {
          orderBy: { occurredAt: "desc" },
          select: { quantityDelta: true, occurredAt: true },
        },
        supplierProducts: {
          where: { supplier: { active: true } },
          orderBy: [{ isPreferred: "desc" }, { priority: "asc" }],
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                currency: true,
                orderDays: true,
                cutoffTime: true,
                deliveryLeadDays: true,
                minimumOrderValue: true,
                freeDeliveryThreshold: true,
              },
            },
            receiptLines: {
              orderBy: [
                { receipt: { receiptDate: "desc" } },
                { createdAt: "desc" },
              ],
              take: 1,
              select: {
                quantity: true,
                packagePrice: true,
                receipt: { select: { receiptDate: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const timeZone = profile?.timezone ?? "Asia/Jerusalem";
  const defaultCurrency = profile?.currency ?? "ILS";
  const todayIndex = getWeekdayIndex(now, timeZone);
  const baskets = new Map<string, SupplierBasket>();

  for (const product of products) {
    const supplierProduct = product.supplierProducts[0];
    if (!supplierProduct) continue;

    const onHand = currentQuantity(product.movements);
    const minimum = currentMinimum(product.minimumStock);
    if (minimum <= 0 || onHand >= minimum) continue;

    const latestReceiptLine = supplierProduct.receiptLines[0];
    const lastReceiptDate = latestReceiptLine?.receipt.receiptDate ?? null;
    const usageSinceLastReceipt = product.movements.reduce(
      (total, movement) => {
        if (lastReceiptDate && movement.occurredAt <= lastReceiptDate)
          return total;
        const delta = finiteNumber(movement.quantityDelta);
        return delta < 0 ? total + Math.abs(delta) : total;
      },
      0,
    );
    const shortageQuantity = Math.max(minimum - onHand, 0);
    const baseRecommended = Math.max(shortageQuantity, usageSinceLastReceipt);
    const unitsPerPackage = Math.max(
      finiteNumber(supplierProduct.unitsPerPackage, 1),
      1,
    );
    const minimumPackages = Math.max(supplierProduct.minimumPackages ?? 0, 0);
    const packageCount = Math.max(
      minimumPackages,
      Math.ceil(baseRecommended / unitsPerPackage),
      1,
    );
    const recommendedQuantity = Number(
      (packageCount * unitsPerPackage).toFixed(3),
    );
    const latestPackagePrice =
      latestReceiptLine?.packagePrice === null ||
      latestReceiptLine?.packagePrice === undefined
        ? supplierProduct.latestPackagePrice === null
          ? null
          : finiteNumberOrNull(supplierProduct.latestPackagePrice)
        : finiteNumberOrNull(latestReceiptLine.packagePrice);
    const estimatedCost =
      latestPackagePrice === null
        ? null
        : Number((latestPackagePrice * packageCount).toFixed(2));

    const supplier = supplierProduct.supplier;
    const orderOffset = daysUntilOrder(supplier.orderDays, todayIndex);
    const minimumValue = finiteNumber(
      supplier.freeDeliveryThreshold ?? supplier.minimumOrderValue ?? 0,
    );
    const existing = baskets.get(supplier.id) ?? {
      supplierId: supplier.id,
      supplierName: displayText(supplier.name, "Supplier"),
      logo: displayText(supplier.name, "S").slice(0, 1).toUpperCase(),
      currency: displayText(supplier.currency, defaultCurrency),
      cutoffLabel:
        orderOffset === 0
          ? cutoffLabel(supplier.cutoffTime, true, timeZone, now)
          : orderOffset === null
            ? (supplier.cutoffTime ?? "No cutoff")
            : `${supplier.cutoffTime ?? "No cutoff"} · in ${orderOffset} day${orderOffset === 1 ? "" : "s"}`,
      deliveryLabel:
        supplier.deliveryLeadDays === 1
          ? "Delivery in 1 day"
          : `Delivery in ${supplier.deliveryLeadDays} days`,
      minimumValue,
      basketValue: 0,
      remainingValue: 0,
      itemCount: 0,
      items: [],
    };

    existing.items.push({
      productId: product.id,
      productName: displayText(product.name, "Unnamed item"),
      unit: displayText(product.baseUnit, "units"),
      currentQuantity: Number(onHand.toFixed(3)),
      minimumQuantity: Number(minimum.toFixed(3)),
      shortageQuantity: Number(shortageQuantity.toFixed(3)),
      usageSinceLastReceipt: Number(usageSinceLastReceipt.toFixed(3)),
      recommendedQuantity,
      unitsPerPackage,
      packageCount,
      latestPackagePrice,
      estimatedCost,
      supplierSku: displayText(supplierProduct.supplierSku, "") || null,
      lastReceiptDate: receiptDateLabel(lastReceiptDate),
      lastReceiptQuantity:
        latestReceiptLine?.quantity === null ||
        latestReceiptLine?.quantity === undefined
          ? null
          : finiteNumberOrNull(latestReceiptLine.quantity),
    });
    existing.basketValue += estimatedCost ?? 0;
    existing.itemCount += 1;
    baskets.set(supplier.id, existing);
  }

  const orderedBaskets = [...baskets.values()]
    .map((basket) => ({
      ...basket,
      basketValue: Number(basket.basketValue.toFixed(2)),
      remainingValue: Number(
        Math.max(basket.minimumValue - basket.basketValue, 0).toFixed(2),
      ),
      items: basket.items.sort(
        (left, right) => right.shortageQuantity - left.shortageQuantity,
      ),
    }))
    .sort((left, right) => {
      const leftHasCutoff = left.cutoffLabel.includes("Closed") ? 1 : 0;
      const rightHasCutoff = right.cutoffLabel.includes("Closed") ? 1 : 0;
      if (leftHasCutoff !== rightHasCutoff)
        return leftHasCutoff - rightHasCutoff;
      return right.itemCount - left.itemCount;
    });

  const currency = orderedBaskets[0]?.currency ?? defaultCurrency;
  const itemCount = orderedBaskets.reduce(
    (total, basket) => total + basket.items.length,
    0,
  );
  const basketValue = orderedBaskets.reduce(
    (total, basket) => total + basket.basketValue,
    0,
  );
  const criticalCount = orderedBaskets.reduce(
    (total, basket) =>
      total + basket.items.filter((item) => item.currentQuantity <= 0).length,
    0,
  );

  return {
    currency,
    summary: {
      supplierCount: orderedBaskets.length,
      itemCount,
      basketValue: Number(basketValue.toFixed(2)),
      criticalCount,
    },
    baskets: orderedBaskets,
  };
}

export async function getOrderApprovalRequests(
  organizationId: string,
  userId: string,
  role: string,
): Promise<OrderApprovalRequest[]> {
  const canReview = role === "owner" || role === "manager";
  const requests = await prisma.orderBasketRequest.findMany({
    where: {
      businessId: organizationId,
      ...(canReview ? {} : { requestedById: userId }),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 40,
    include: {
      supplier: { select: { name: true } },
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      lines: { orderBy: { productName: "asc" } },
    },
  });

  return requests.map((request) => ({
    id: request.id,
    status: request.status,
    supplierId: request.supplierId,
    supplierName: displayText(request.supplier.name, "Supplier"),
    currency: displayText(request.currency, "ILS"),
    note: displayText(request.note, "") || null,
    requesterName: displayText(request.requestedBy.name, "Employee"),
    reviewerName: displayText(request.reviewedBy?.name, "") || null,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    lines: request.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: displayText(line.productName, "Item"),
      supplierSku: displayText(line.supplierSku, "") || null,
      unit: displayText(line.unit, "units"),
      requestedQuantity: finiteNumber(line.requestedQuantity),
      unitsPerPackage: finiteNumber(line.unitsPerPackage, 1),
      packageCount: Math.max(0, line.packageCount),
      latestPackagePrice: finiteNumberOrNull(line.latestPackagePrice),
      estimatedCost: finiteNumberOrNull(line.estimatedCost),
    })),
  }));
}
