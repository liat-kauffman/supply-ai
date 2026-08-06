import { prisma } from "@supply/database";

import { displayText, finiteNumber } from "@/lib/display";

export interface AnalyticsPeriod {
  spend: number;
  receiptCount: number;
  approvedCount: number;
  pendingCount: number;
  lineCount: number;
  averageReceipt: number;
  topSupplier: string;
}

export interface AnalyticsData {
  currency: string;
  monthLabel: string;
  yearLabel: string;
  month: AnalyticsPeriod;
  year: AnalyticsPeriod;
  monthlyTrend: Array<{ label: string; spend: number; receiptCount: number }>;
  supplierSpend: Array<{ name: string; spend: number; receiptCount: number }>;
  orders: {
    monthCount: number;
    yearCount: number;
    approvedCount: number;
    pendingCount: number;
    estimatedSpend: number;
  };
  inventory: {
    activeProducts: number;
    activeSuppliers: number;
  };
}

type AnalyticsReceipt = {
  receiptDate: Date;
  supplier: { name: string };
  currency: string;
  status: string;
  totalAmount: unknown;
  lines: Array<{ lineTotal: unknown; category: string | null }>;
};

function receiptSpend(receipt: AnalyticsReceipt) {
  const total = finiteNumber(receipt.totalAmount);
  return total > 0
    ? total
    : receipt.lines.reduce(
        (sum, line) => sum + finiteNumber(line.lineTotal),
        0,
      );
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

export async function getAnalyticsData(
  organizationId: string,
): Promise<AnalyticsData> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [profile, receipts, orders, activeProducts, activeSuppliers] =
    await Promise.all([
      prisma.businessProfile.findUnique({
        where: { id: organizationId },
        select: { currency: true },
      }),
      prisma.receipt.findMany({
        where: {
          businessId: organizationId,
          receiptDate: { gte: trendStart, lte: now },
        },
        orderBy: { receiptDate: "desc" },
        select: {
          receiptDate: true,
          supplier: { select: { name: true } },
          currency: true,
          status: true,
          totalAmount: true,
          lines: { select: { lineTotal: true, category: true } },
        },
      }),
      prisma.orderBasketRequest.findMany({
        where: { businessId: organizationId, createdAt: { gte: yearStart } },
        select: {
          createdAt: true,
          status: true,
          lines: { select: { estimatedCost: true } },
        },
      }),
      prisma.product.count({
        where: { businessId: organizationId, active: true },
      }),
      prisma.supplier.count({
        where: { businessId: organizationId, active: true },
      }),
    ]);

  const typedReceipts = receipts as AnalyticsReceipt[];
  const currency = displayText(
    profile?.currency ?? typedReceipts[0]?.currency,
    "ILS",
  ).toUpperCase();

  function summarize(start: Date): AnalyticsPeriod {
    const periodReceipts = typedReceipts.filter(
      (receipt) => receipt.receiptDate >= start && receipt.receiptDate <= now,
    );
    const supplierTotals = new Map<string, number>();
    const spend = periodReceipts.reduce((total, receipt) => {
      const value = receiptSpend(receipt);
      const supplier = displayText(receipt.supplier.name, "Unknown supplier");
      supplierTotals.set(supplier, (supplierTotals.get(supplier) ?? 0) + value);
      return total + value;
    }, 0);
    const topSupplier =
      [...supplierTotals.entries()].sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0] ?? "No supplier data";

    return {
      spend,
      receiptCount: periodReceipts.length,
      approvedCount: periodReceipts.filter(
        (receipt) => receipt.status.toUpperCase() === "APPROVED",
      ).length,
      pendingCount: periodReceipts.filter(
        (receipt) => receipt.status.toUpperCase() !== "APPROVED",
      ).length,
      lineCount: periodReceipts.reduce(
        (total, receipt) => total + receipt.lines.length,
        0,
      ),
      averageReceipt: periodReceipts.length ? spend / periodReceipts.length : 0,
      topSupplier,
    };
  }

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = monthKey(date);
    const monthReceipts = typedReceipts.filter(
      (receipt) => monthKey(receipt.receiptDate) === key,
    );
    return {
      label: monthLabel(date),
      spend: monthReceipts.reduce(
        (sum, receipt) => sum + receiptSpend(receipt),
        0,
      ),
      receiptCount: monthReceipts.length,
    };
  });

  const supplierMap = new Map<
    string,
    { spend: number; receiptCount: number }
  >();
  typedReceipts.forEach((receipt) => {
    const name = displayText(receipt.supplier.name, "Unknown supplier");
    const current = supplierMap.get(name) ?? { spend: 0, receiptCount: 0 };
    current.spend += receiptSpend(receipt);
    current.receiptCount += 1;
    supplierMap.set(name, current);
  });

  const yearOrders = orders.filter((order) => order.createdAt >= yearStart);
  const monthOrders = yearOrders.filter(
    (order) => order.createdAt >= currentMonthStart,
  );

  return {
    currency,
    monthLabel: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(now),
    yearLabel: String(now.getFullYear()),
    month: summarize(currentMonthStart),
    year: summarize(yearStart),
    monthlyTrend,
    supplierSpend: [...supplierMap.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((left, right) => right.spend - left.spend)
      .slice(0, 5),
    orders: {
      monthCount: monthOrders.length,
      yearCount: yearOrders.length,
      approvedCount: yearOrders.filter(
        (order) => order.status.toUpperCase() === "APPROVED",
      ).length,
      pendingCount: yearOrders.filter(
        (order) => order.status.toUpperCase() === "PENDING",
      ).length,
      estimatedSpend: yearOrders.reduce(
        (total, order) =>
          total +
          order.lines.reduce(
            (sum, line) => sum + finiteNumber(line.estimatedCost),
            0,
          ),
        0,
      ),
    },
    inventory: { activeProducts, activeSuppliers },
  };
}
