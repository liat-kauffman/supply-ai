import { prisma } from "@supply/database";

import { displayText, finiteNumber } from "@/lib/display";

export interface DashboardData {
  periodSummary: {
    month: PeriodSummaryData;
    year: PeriodSummaryData;
  };
  headerEyebrow: string;
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    emphasis?: string;
    trend?: "up" | "down";
    tone: "amber" | "red" | "green" | "blue";
    icon: "receipt" | "alert" | "money" | "chart";
  }>;
  tasks: Array<{
    title: string;
    detail: string;
    tag: string;
    tone: "amber" | "mint" | "blue";
    icon: "receipt" | "camera" | "package";
  }>;
  stock: Array<{
    name: string;
    meta: string;
    value: number;
    status: string;
    tone: "danger" | "good";
  }>;
  supplier: {
    name: string;
    logo: string;
    deliveryLabel: string;
    cutoffLabel: string;
    basketValue: number;
    minimumValue: number;
    currency: string;
    remainingMessage: string;
  };
  nextSupplier: {
    name: string;
    logo: string;
    schedule: string;
    relativeTime: string;
  };
  insight: {
    title: string;
    description: string;
    confidence: number;
    dataDays: number | null;
  };
}

export interface PeriodSummaryData {
  spend: number;
  receiptCount: number;
  approvedCount: number;
  currency: string;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(finiteNumber(value));
}

function shortCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(finiteNumber(value));
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

function headerEyebrow(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  })
    .format(date)
    .toUpperCase();
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

export async function getDashboardData(
  organizationId: string,
): Promise<DashboardData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [profile, products, receipts, suppliers] = await Promise.all([
    prisma.businessProfile.findUnique({
      where: { id: organizationId },
      select: { timezone: true, currency: true },
    }),
    prisma.product.findMany({
      where: { businessId: organizationId, active: true },
      include: {
        movements: {
          orderBy: { occurredAt: "desc" },
          select: { quantityDelta: true, occurredAt: true },
        },
        supplierProducts: {
          orderBy: [{ isPreferred: "desc" }, { priority: "asc" }],
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                currency: true,
                active: true,
              },
            },
          },
        },
      },
    }),
    prisma.receipt.findMany({
      where: { businessId: organizationId },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      include: {
        supplier: { select: { name: true } },
        lines: { select: { lineTotal: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { businessId: organizationId, active: true },
      include: {
        products: {
          include: {
            product: {
              include: {
                movements: { select: { quantityDelta: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const timeZone = displayText(profile?.timezone, "Asia/Jerusalem");
  const currency = displayText(
    profile?.currency ?? receipts[0]?.currency,
    "ILS",
  ).toUpperCase();
  const todayIndex = getWeekdayIndex(now, timeZone);

  const stockItems = products
    .map((product) => {
      const quantity = currentQuantity(product.movements);
      const minimum = currentMinimum(product.minimumStock);
      const ratio =
        minimum > 0
          ? Math.max(0, Math.min(100, (quantity / minimum) * 100))
          : 100;
      const supplierName = displayText(
        product.supplierProducts[0]?.supplier.name,
        "No supplier",
      );
      return {
        id: product.id,
        name: displayText(product.name, "Unnamed item"),
        quantity,
        minimum,
        unit: displayText(product.baseUnit, "units"),
        supplierName,
        lastMovementAt: product.movements[0]?.occurredAt ?? null,
        ratio,
      };
    })
    .sort((left, right) => left.ratio - right.ratio);

  const lowStockItems = stockItems.filter(
    (item) => item.minimum > 0 && item.quantity < item.minimum,
  );
  const criticalItems = stockItems.filter((item) => item.quantity <= 0);
  const recentCounted = stockItems.filter(
    (item) => item.lastMovementAt && item.lastMovementAt >= weekAgo,
  ).length;
  const stockConfidence = stockItems.length
    ? Math.round((recentCounted / stockItems.length) * 100)
    : 0;

  const pendingReceipts = receipts.filter(
    (receipt) => receipt.status.toUpperCase() !== "APPROVED",
  );
  const summarizePeriod = (start: Date): PeriodSummaryData => {
    const periodReceipts = receipts.filter(
      (receipt) => receipt.receiptDate >= start && receipt.receiptDate <= now,
    );
    return {
      spend: periodReceipts.reduce(
        (total, receipt) =>
          total +
          receipt.lines.reduce(
            (sum, line) => sum + finiteNumber(line.lineTotal),
            0,
          ),
        0,
      ),
      receiptCount: periodReceipts.length,
      approvedCount: periodReceipts.filter(
        (receipt) => receipt.status.toUpperCase() === "APPROVED",
      ).length,
      currency,
    };
  };
  const weekReceipts = receipts.filter(
    (receipt) => receipt.receiptDate >= weekAgo,
  );
  const previousWeekReceipts = receipts.filter(
    (receipt) =>
      receipt.receiptDate >= twoWeeksAgo && receipt.receiptDate < weekAgo,
  );
  const weeklySpend = weekReceipts.reduce(
    (total, receipt) =>
      total +
      receipt.lines.reduce(
        (sum, line) => sum + finiteNumber(line.lineTotal),
        0,
      ),
    0,
  );
  const previousWeeklySpend = previousWeekReceipts.reduce(
    (total, receipt) =>
      total +
      receipt.lines.reduce(
        (sum, line) => sum + finiteNumber(line.lineTotal),
        0,
      ),
    0,
  );
  const spendTrend =
    previousWeeklySpend === 0
      ? undefined
      : weeklySpend >= previousWeeklySpend
        ? "up"
        : "down";
  const spendDelta =
    previousWeeklySpend === 0
      ? undefined
      : `${Math.abs(
          Math.round(
            ((weeklySpend - previousWeeklySpend) / previousWeeklySpend) * 100,
          ),
        )}%`;

  const metrics: DashboardData["metrics"] = [
    {
      label: "Waiting for review",
      value: String(pendingReceipts.length),
      emphasis:
        pendingReceipts.length > 0
          ? `${pendingReceipts.filter((receipt) => receipt.status === "PENDING").length} receipts`
          : undefined,
      detail:
        pendingReceipts.length > 0
          ? "need approval"
          : "Nothing queued right now",
      icon: "receipt",
      tone: "amber",
    },
    {
      label: "Low stock items",
      value: String(lowStockItems.length),
      emphasis: criticalItems.length
        ? `${criticalItems.length} critical`
        : undefined,
      detail:
        lowStockItems.length > 0
          ? criticalItems.length
            ? "out of stock now"
            : "below minimum"
          : "All tracked items are above minimum",
      icon: "alert",
      tone: "red",
    },
    {
      label: "Receipts this week",
      value: shortCurrency(weeklySpend, currency),
      emphasis: spendDelta
        ? `${spendTrend === "up" ? "↑" : "↓"} ${spendDelta}`
        : undefined,
      detail:
        weekReceipts.length > 0
          ? `from ${weekReceipts.length} approved receipts`
          : "No receipts recorded this week",
      trend: spendTrend,
      icon: "money",
      tone: "green",
    },
    {
      label: "Stock confidence",
      value: `${stockConfidence}%`,
      emphasis: stockItems.length
        ? `${recentCounted} recently updated`
        : undefined,
      detail:
        stockItems.length > 0
          ? "based on the last 7 days of movements"
          : "Add inventory activity to build confidence",
      icon: "chart",
      tone: "blue",
    },
  ];

  const tasks: DashboardData["tasks"] = [];
  for (const receipt of pendingReceipts.slice(0, 2)) {
    const supplierName = displayText(receipt.supplier.name, "Supplier");
    tasks.push({
      title: `Review ${supplierName} receipt`,
      detail: `${receipt.lines.length} lines · ${Math.round(finiteNumber(receipt.confidence) * 100)}% AI confidence`,
      tag: "Approval",
      icon: "receipt",
      tone: "amber",
    });
  }
  if (lowStockItems[0]) {
    tasks.push({
      title: `Restock ${lowStockItems[0].name}`,
      detail: `${Math.max(lowStockItems[0].quantity, 0)} ${lowStockItems[0].unit} on hand · minimum ${lowStockItems[0].minimum}`,
      tag: lowStockItems[0].supplierName,
      icon: "package",
      tone: "blue",
    });
  }

  const rankedSuppliers = suppliers
    .map((supplier) => {
      const supplierName = displayText(supplier.name, "Supplier");
      const supplierCurrency = displayText(supplier.currency, currency);
      const supplierCutoffTime = displayText(supplier.cutoffTime, "") || null;
      const offset = daysUntilOrder(supplier.orderDays, todayIndex);
      const basketValue = supplier.products.reduce((total, supplierProduct) => {
        const quantity = currentQuantity(supplierProduct.product.movements);
        const minimum = currentMinimum(supplierProduct.product.minimumStock);
        const shortage = Math.max(minimum - quantity, 0);
        if (!shortage || supplierProduct.latestPackagePrice === null)
          return total;
        const unitsPerPackage = Math.max(
          finiteNumber(supplierProduct.unitsPerPackage, 1),
          1,
        );
        const packagesNeeded = Math.ceil(shortage / unitsPerPackage);
        return (
          total +
          finiteNumber(supplierProduct.latestPackagePrice) * packagesNeeded
        );
      }, 0);
      const minimumValue = finiteNumber(
        supplier.freeDeliveryThreshold ?? supplier.minimumOrderValue ?? 0,
      );
      return {
        ...supplier,
        name: supplierName,
        currency: supplierCurrency,
        cutoffTime: supplierCutoffTime,
        orderOffset: offset,
        basketValue,
        minimumValue,
      };
    })
    .sort((left, right) => {
      if (left.orderOffset === null) return 1;
      if (right.orderOffset === null) return -1;
      return left.orderOffset - right.orderOffset;
    });

  const primarySupplier = rankedSuppliers[0];
  const fallbackSupplier = {
    name: "No supplier schedule yet",
    logo: "—",
    deliveryLabel: "Add supplier cutoffs in company setup",
    cutoffLabel: "No deadline",
    basketValue: 0,
    minimumValue: 0,
    currency,
    remainingMessage: "No supplier order schedule has been configured yet.",
  };

  const supplierCard = primarySupplier
    ? {
        name: primarySupplier.name,
        logo: primarySupplier.name.slice(0, 1).toUpperCase(),
        deliveryLabel:
          primarySupplier.deliveryLeadDays === 1
            ? "Delivery in 1 day"
            : `Delivery in ${primarySupplier.deliveryLeadDays} days`,
        cutoffLabel:
          primarySupplier.orderOffset === 0
            ? cutoffLabel(primarySupplier.cutoffTime, true, timeZone, now)
            : `${primarySupplier.cutoffTime ?? "No cutoff"} · in ${primarySupplier.orderOffset} day${primarySupplier.orderOffset === 1 ? "" : "s"}`,
        basketValue: Math.round(primarySupplier.basketValue),
        minimumValue: Math.round(primarySupplier.minimumValue),
        currency: primarySupplier.currency,
        remainingMessage:
          primarySupplier.minimumValue > primarySupplier.basketValue
            ? `${formatCurrency(
                primarySupplier.minimumValue - primarySupplier.basketValue,
                primarySupplier.currency,
              )} more to reach the target`
            : "Basket is already above the supplier target",
      }
    : fallbackSupplier;

  const secondarySupplier = rankedSuppliers[1] ?? primarySupplier;
  const nextSupplier = secondarySupplier
    ? {
        name: secondarySupplier.name,
        logo: secondarySupplier.name.slice(0, 1).toUpperCase(),
        schedule: secondarySupplier.cutoffTime
          ? `Cutoff ${secondarySupplier.cutoffTime}`
          : "No cutoff time set",
        relativeTime:
          secondarySupplier.orderOffset === null
            ? "No order day"
            : secondarySupplier.orderOffset === 0
              ? "Today"
              : `In ${secondarySupplier.orderOffset} day${secondarySupplier.orderOffset === 1 ? "" : "s"}`,
      }
    : {
        name: "No next supplier",
        logo: "—",
        schedule: "Add another supplier to compare cutoffs",
        relativeTime: "Waiting",
      };

  if (!tasks.length && primarySupplier) {
    tasks.push({
      title: `Review ${primarySupplier.name} basket`,
      detail:
        primarySupplier.orderOffset === 0
          ? "Supplier cutoff is due today"
          : `Next supplier window is in ${primarySupplier.orderOffset ?? 0} days`,
      tag: shortCurrency(primarySupplier.basketValue, primarySupplier.currency),
      icon: "package",
      tone: "blue",
    });
  }
  if (!tasks.length) {
    tasks.push({
      title: "Capture your first receipt",
      detail: "There is no supplier receipt history yet.",
      tag: "Get started",
      icon: "camera",
      tone: "mint",
    });
  }

  const stock = stockItems.slice(0, 3).map((item) => ({
    name: item.name,
    meta: `${item.quantity} ${item.unit} · min ${item.minimum}`,
    value: Math.round(item.ratio),
    status:
      item.quantity <= 0
        ? "Order"
        : item.quantity < item.minimum
          ? "Low"
          : "Healthy",
    tone:
      item.quantity < item.minimum ? ("danger" as const) : ("good" as const),
  }));

  const insightTarget = lowStockItems[0] ?? stockItems[0] ?? null;
  const oldestMovement = products
    .flatMap((product) =>
      product.movements.map((movement) => movement.occurredAt),
    )
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const dataDays = oldestMovement
    ? Math.max(
        1,
        Math.round(
          (now.getTime() - oldestMovement.getTime()) / (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  const insight = insightTarget
    ? {
        title:
          insightTarget.quantity < insightTarget.minimum
            ? `${insightTarget.name} is your biggest stock risk right now.`
            : `${insightTarget.name} is one of your healthiest tracked items.`,
        description:
          insightTarget.quantity < insightTarget.minimum
            ? `${insightTarget.supplierName} is the preferred supplier, and you currently have ${insightTarget.quantity} ${insightTarget.unit} against a minimum of ${insightTarget.minimum}. This item should be part of the next supplier review.`
            : `${insightTarget.name} is currently above its minimum level, with ${insightTarget.quantity} ${insightTarget.unit} on hand against a minimum of ${insightTarget.minimum}.`,
        confidence: insightTarget.supplierName === "No supplier" ? 82 : 96,
        dataDays,
      }
    : {
        title: "Add inventory activity to unlock live guidance.",
        description:
          "Once products, receipts, and stock counts are in place, Supplai will turn the Today tab into a live operational summary.",
        confidence: 100,
        dataDays: null,
      };

  return {
    periodSummary: {
      month: summarizePeriod(monthStart),
      year: summarizePeriod(yearStart),
    },
    headerEyebrow: headerEyebrow(now, timeZone),
    metrics,
    tasks: tasks.slice(0, 3),
    stock,
    supplier: supplierCard,
    nextSupplier,
    insight,
  };
}
