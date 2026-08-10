import { NextResponse } from "next/server";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { getAnalyticsData } from "@/lib/analytics";
import {
  reportForPrompt,
  wantsWeeklyReceiptPreVatReport,
} from "@/lib/ai-workspace-reports";
import { suggestionsForAiWorkspaceAnswer } from "@/lib/ai-workspace-suggestions";
import { generateGeminiContent } from "@/lib/gemini";
import { getInventoryItems } from "@/lib/inventory";
import { displayMoney } from "@/lib/display";
import { prisma } from "@supply/database";

type SupplierSchedule = { name: string; orderDays: number[] };
const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function nextOrderDay(orderDays: number[]) {
  if (!orderDays.length) return null;
  const today = new Date().getDay();
  const offset = Math.min(...orderDays.map((day) => (day - today + 7) % 7));
  return { name: weekdayNames[(today + offset) % 7], offset };
}

function fallbackAnswer(
  prompt: string,
  analytics: Awaited<ReturnType<typeof getAnalyticsData>>,
  inventory: Awaited<ReturnType<typeof getInventoryItems>>,
  schedules: SupplierSchedule[],
) {
  const normalized = prompt.toLowerCase();
  if (wantsWeeklyReceiptPreVatReport(prompt)) {
    return "I created a weekly receipt summary with exactly two columns: the Sunday week-start date and the total before VAT. Use the Excel download below.";
  }
  if (
    (normalized.includes("add") || normalized.includes("expand")) &&
    (normalized.includes("product") || normalized.includes("item"))
  ) {
    const lowStock = inventory.filter(
      (item) => item.status === "low" || item.status === "out",
    );
    const categories = new Set(inventory.map((item) => item.category)).size;
    return `I would not add products based on inventory data alone. This workspace currently tracks ${analytics.inventory.activeProducts} active products across ${categories} categories, with ${lowStock.length} item${lowStock.length === 1 ? "" : "s"} already below minimum stock. Before expanding the catalog, check product-level sales, customer requests, gross margin, stockout frequency, and supplier lead times. Those figures would show whether demand exists for new products or whether the current range needs better replenishment first.`;
  }
  if (
    normalized.includes("which data") ||
    normalized.includes("what data") ||
    normalized.includes("data would you need")
  ) {
    return "To evaluate adding products, I would need:\n- Product-level sales volume\n- Customer requests or unavailable-item counts\n- Gross margin by product\n- Stockout frequency\n- Waste or expiry\n- Supplier lead times\n- Storage capacity\n\nSupplai currently has inventory, receipt, supplier, order, and stock-level records, but it does not yet have sales or customer-demand data.";
  }
  if (
    normalized.includes("how many") &&
    (normalized.includes("product") || normalized.includes("item"))
  ) {
    return `This workspace has ${analytics.inventory.activeProducts} active inventory items across ${analytics.inventory.activeSuppliers} active suppliers.`;
  }
  if (normalized.includes("how many") && normalized.includes("supplier")) {
    return `This workspace has ${analytics.inventory.activeSuppliers} active suppliers.`;
  }
  if (normalized.includes("how many") && normalized.includes("receipt")) {
    return `There are ${analytics.year.receiptCount} recorded receipts this year and ${analytics.month.receiptCount} in the current month.`;
  }
  if (normalized.includes("how many") && normalized.includes("order")) {
    return `There are ${analytics.orders.yearCount} order requests this year: ${analytics.orders.approvedCount} approved and ${analytics.orders.pendingCount} pending.`;
  }
  const namedItem = inventory.find((item) =>
    normalized.includes(item.name.toLowerCase()),
  );
  if (namedItem) {
    return `${namedItem.name} currently has ${namedItem.quantity} ${namedItem.unit} on hand against a minimum of ${namedItem.minimum}. Its status is ${namedItem.status}, and its preferred supplier is ${namedItem.supplier}.`;
  }
  if (
    normalized.includes("short") ||
    normalized.includes("shortage") ||
    normalized.includes("missing")
  ) {
    const lowStock = inventory.filter(
      (item) => item.status === "low" || item.status === "out",
    );
    const lowStockSummary = lowStock.length
      ? lowStock
          .map(
            (item) =>
              `- ${item.name}: ${item.quantity} ${item.unit} on hand vs ${item.minimum} minimum`,
          )
          .join("\n")
      : "- No tracked items are currently below minimum stock";
    const explicitlyRequested = [
      "cucumber",
      "cucumbers",
      "tomato",
      "tomatoes",
    ].filter((item) => normalized.includes(item));
    const untrackedNote = explicitlyRequested.length
      ? `\n\n${explicitlyRequested.join(" and ")} ${explicitlyRequested.length === 1 ? "is" : "are"} not currently tracked as inventory, so I cannot verify ${explicitlyRequested.length === 1 ? "its" : "their"} shortage.`
      : "";
    return `Based on the current catalog, the items short are:\n${lowStockSummary}${untrackedNote}`;
  }
  if (
    /reduce|save|saving|cut|lower|opportunit|optimiz/.test(normalized) &&
    /cost|spend|purchas|supplier|expense/.test(normalized)
  ) {
    const topSupplier = analytics.supplierSpend[0];
    const frequentSupplier = [...analytics.supplierSpend].sort(
      (left, right) => right.receiptCount - left.receiptCount,
    )[0];
    const lowStock = inventory.filter(
      (item) => item.status === "low" || item.status === "out",
    );
    const opportunities = [
      topSupplier
        ? `Benchmark ${topSupplier.name}'s prices or request volume pricing. It has the highest recorded six-month spend at ${displayMoney(topSupplier.spend, analytics.currency)} across ${topSupplier.receiptCount} receipt${topSupplier.receiptCount === 1 ? "" : "s"}.`
        : "Add supplier receipt data so Supplai can identify where price comparisons would have the most impact.",
      frequentSupplier
        ? `Review whether ${frequentSupplier.name}'s ${frequentSupplier.receiptCount} purchases can be consolidated around its order days. Fewer purchases may reduce delivery fees, but confirm minimums and storage capacity first.`
        : "Track purchase frequency by supplier to find orders that could be consolidated.",
      lowStock.length
        ? `Plan replenishment for ${lowStock.map((item) => item.name).join(", ")} before stock becomes urgent. ${lowStock.length} tracked item${lowStock.length === 1 ? " is" : "s are"} currently below minimum, where avoiding emergency purchases may reduce cost.`
        : "No tracked items are currently below minimum stock, so there is no immediate emergency-purchase signal in the inventory data.",
    ];
    return `The current records point to three places worth investigating. These are opportunities to validate, not guaranteed savings:\n${opportunities.map((opportunity) => `- ${opportunity}`).join("\n")}`;
  }
  if (normalized.includes("supplier") || normalized.includes("vendor")) {
    const suppliers = analytics.supplierSpend
      .map(
        (supplier) =>
          `${supplier.name} (${displayMoney(supplier.spend, analytics.currency)}, ${supplier.receiptCount} receipts)`,
      )
      .join("; ");
    return suppliers
      ? `Recorded supplier spend for the last six months is: ${suppliers}. The highest recorded spend is with ${analytics.supplierSpend[0]?.name ?? "No supplier data"}.`
      : "There is no recorded supplier spend in the current workspace yet.";
  }
  if (
    normalized.includes("when") &&
    (normalized.includes("order day") ||
      normalized.includes("order") ||
      normalized.includes("delivery"))
  ) {
    const matchedItem = inventory.find(
      (item) =>
        normalized.includes(item.name.toLowerCase()) ||
        normalized.includes(item.category.toLowerCase()),
    );
    const matchedSchedule = schedules.find(
      (schedule) =>
        normalized.includes(schedule.name.toLowerCase()) ||
        schedule.name === matchedItem?.supplier,
    );
    const next = matchedSchedule
      ? nextOrderDay(matchedSchedule.orderDays)
      : null;
    if (matchedSchedule && next) {
      return `The next order day for ${matchedSchedule.name} is ${next.name}${next.offset === 0 ? " (today)" : `, in ${next.offset} day${next.offset === 1 ? "" : "s"}`}.`;
    }
    const available = schedules
      .map((schedule) => {
        const upcoming = nextOrderDay(schedule.orderDays);
        return upcoming ? `${schedule.name}: ${upcoming.name}` : null;
      })
      .filter(Boolean)
      .join("; ");
    return available
      ? `I couldn't match “${prompt}” to one supplier. The next available supplier order days are: ${available}.`
      : "No supplier order-day schedules are configured for this workspace.";
  }
  if (
    (normalized.includes("make") ||
      normalized.includes("create") ||
      normalized.includes("place")) &&
    normalized.includes("order")
  ) {
    const requestedItems = inventory.filter(
      (item) =>
        normalized.includes(item.name.toLowerCase()) ||
        normalized.includes(item.category.toLowerCase()),
    );
    const lowRequestedItems = requestedItems.filter(
      (item) => item.status === "low" || item.status === "out",
    );
    if (!requestedItems.length) {
      return `I can prepare an order draft, but I couldn't match “${prompt}” to an inventory item or category. Tell me the exact items and quantities. No order was created.`;
    }
    const itemSummary = requestedItems
      .map(
        (item) =>
          `${item.name}: ${item.quantity} ${item.unit} on hand, minimum ${item.minimum}`,
      )
      .join("; ");
    return `I can prepare a draft order for ${requestedItems.map((item) => item.name).join(", ")}. Current records: ${itemSummary}. ${lowRequestedItems.length ? `${lowRequestedItems.length} item${lowRequestedItems.length === 1 ? " is" : "s are"} below minimum.` : "These items are not currently below minimum."} No order was created. Confirm the quantities and supplier, then I can prepare the approval request.`;
  }
  if (normalized.includes("order")) {
    return `This year there are ${analytics.orders.yearCount} order requests: ${analytics.orders.approvedCount} approved and ${analytics.orders.pendingCount} pending. Their estimated spend is ${displayMoney(analytics.orders.estimatedSpend, analytics.currency)}.`;
  }
  if (normalized.includes("receipt") || normalized.includes("purchase")) {
    return `This month has ${analytics.month.receiptCount} recorded receipts totaling ${displayMoney(analytics.month.spend, analytics.currency)}. For ${analytics.yearLabel}, there are ${analytics.year.receiptCount} receipts totaling ${displayMoney(analytics.year.spend, analytics.currency)}, with an average receipt of ${displayMoney(analytics.year.averageReceipt, analytics.currency)}.`;
  }
  if (
    normalized.includes("risk") ||
    normalized.includes("critical") ||
    normalized.includes("danger")
  ) {
    const riskyItems = inventory
      .filter((item) => item.status === "low" || item.status === "out")
      .sort(
        (left, right) =>
          left.quantity / Math.max(left.minimum, 1) -
          right.quantity / Math.max(right.minimum, 1),
      );
    const item = riskyItems[0];
    return item
      ? `${item.name} is currently the highest stock risk: ${item.quantity} ${item.unit} on hand against a minimum of ${item.minimum}. Its status is ${item.status}, and its preferred supplier is ${item.supplier}.`
      : "No active inventory item is currently below its minimum stock level.";
  }
  if (
    (normalized.includes("highest") ||
      normalized.includes("most") ||
      normalized.includes("largest")) &&
    (normalized.includes("spend") ||
      normalized.includes("cost") ||
      normalized.includes("month"))
  ) {
    const highestMonth = [...analytics.monthlyTrend].sort(
      (left, right) => right.spend - left.spend,
    )[0];
    if (highestMonth) {
      return `${highestMonth.label} had the highest recorded spend at ${displayMoney(highestMonth.spend, analytics.currency)} across ${highestMonth.receiptCount} receipt${highestMonth.receiptCount === 1 ? "" : "s"}.`;
    }
  }
  if (
    normalized.includes("lowest") ||
    normalized.includes("least") ||
    normalized.includes("cheapest") ||
    normalized.includes("smallest")
  ) {
    const lowestMonth = [...analytics.monthlyTrend].sort(
      (left, right) => left.spend - right.spend,
    )[0];
    if (lowestMonth) {
      return `${lowestMonth.label} had the lowest recorded spend at ${displayMoney(lowestMonth.spend, analytics.currency)} across ${lowestMonth.receiptCount} receipt${lowestMonth.receiptCount === 1 ? "" : "s"}. Based on the available data, the reason is that this month had the lowest number and/or value of recorded purchases in the six-month trend. I cannot determine an operational cause without sales or usage data.`;
    }
  }
  if (
    normalized.includes("trend") ||
    normalized.includes("month") ||
    normalized.includes("spend") ||
    normalized.includes("cost")
  ) {
    const trend = analytics.monthlyTrend
      .map(
        (month) =>
          `${month.label}: ${displayMoney(month.spend, analytics.currency)}`,
      )
      .join("; ");
    return `Recorded spend over the last six months is ${trend}. The current month is ${displayMoney(analytics.month.spend, analytics.currency)} across ${analytics.month.receiptCount} receipts.`;
  }
  if (normalized.includes("inventory") || normalized.includes("stock")) {
    const lowStock = inventory.filter(
      (item) => item.status === "low" || item.status === "out",
    );
    return lowStock.length
      ? `You currently have ${lowStock.length} item${lowStock.length === 1 ? "" : "s"} below the healthy stock threshold: ${lowStock.map((item) => item.name).join(", ")}. The next useful step is to review supplier availability before the next cutoff.`
      : "Your active inventory is currently above its minimum levels. I would keep monitoring recent movement and supplier cutoffs before placing the next order.";
  }
  return "I’m here to help with your business. You can ask me about inventory, supplier spending, recent receipts, orders, or creating a report. Choose an option below to get started.";
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await requireApiCompany();
    const body = (await request.json()) as { prompt?: unknown };
    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2_000) : "";
    if (!prompt)
      return NextResponse.json(
        { error: "Ask the AI workspace a question first." },
        { status: 400 },
      );
    const weeklyReceiptPreVatReport = wantsWeeklyReceiptPreVatReport(prompt);

    const [analytics, inventory, schedules, history] = await Promise.all([
      getAnalyticsData(organizationId),
      getInventoryItems(organizationId),
      prisma.supplier.findMany({
        where: { businessId: organizationId, active: true },
        select: { name: true, orderDays: true },
      }),
      prisma.aiWorkspaceMessage.findMany({
        where: { businessId: organizationId, userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { role: true, content: true },
      }),
    ]);
    const context = {
      analytics,
      inventory: inventory.map(
        ({
          name,
          category,
          supplier,
          quantity,
          minimum,
          unit,
          status,
          updated,
        }) => ({
          name,
          category,
          supplier,
          quantity,
          minimum,
          unit,
          status,
          updated,
        }),
      ),
    };
    let answer = fallbackAnswer(prompt, analytics, inventory, schedules);
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && !weeklyReceiptPreVatReport) {
      const result = await generateGeminiContent({
        apiKey,
        timeoutMs: 20_000,
        maxAttempts: 1,
        body: {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are Supplai's business analyst. Answer the exact user question below, directly and specifically. Use the recent conversation only to understand follow-up references such as “that item” or “last month.” Use only the workspace data supplied below, cite exact figures when available, and never invent facts. If the data does not contain the answer, say that clearly. If the user asks for Excel, explain what the generated report contains. Recent conversation:\n${history
                    .reverse()
                    .map((message) => `${message.role}: ${message.content}`)
                    .join(
                      "\n",
                    )}\n\nExact user question: ${prompt}\n\nWorkspace data: ${JSON.stringify(context)}`,
                },
              ],
            },
          ],
        },
      });
      const aiText = result.payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (result.ok && aiText) answer = aiText;
    }
    const report = reportForPrompt(prompt);
    const exportUrl =
      report === "receipts"
        ? "/api/receipts/export"
        : report
          ? `/api/ai-workspace/export?report=${report}`
          : null;
    if (/excel|spreadsheet|xlsx|csv|sheet|report/i.test(prompt) && !report) {
      answer =
        "I can create inventory, receipt, or supplier spreadsheets. Choose which report you want to create below, or describe one of those reports in more detail.";
    }
    await prisma.aiWorkspaceMessage.create({
      data: {
        businessId: organizationId,
        userId,
        role: "user",
        content: prompt,
      },
    });
    const assistantMessage = await prisma.aiWorkspaceMessage.create({
      data: {
        businessId: organizationId,
        userId,
        role: "assistant",
        content: answer,
      },
      select: { id: true },
    });
    return NextResponse.json({
      answer,
      messageId: assistantMessage.id,
      exportUrl,
      suggestions: suggestionsForAiWorkspaceAnswer(answer),
      context: {
        period:
          "Current workspace records and the last six months of purchasing data",
        sources: ["Inventory", "Receipts", "Suppliers", "Orders"],
        limitations:
          "Sales, customer-demand, margin, and waste data are not currently connected.",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to answer from workspace data");
  }
}

export async function GET() {
  try {
    const { organizationId, userId } = await requireApiCompany();
    const messages = await prisma.aiWorkspaceMessage.findMany({
      where: { businessId: organizationId, userId },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: { id: true, role: true, content: true },
    });
    return NextResponse.json({ messages });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load AI workspace history");
  }
}

export async function DELETE() {
  try {
    const { organizationId, userId } = await requireApiCompany();
    const result = await prisma.aiWorkspaceMessage.deleteMany({
      where: { businessId: organizationId, userId },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    return apiErrorResponse(error, "Unable to clear AI workspace history");
  }
}
