import { prisma } from "@supply/database";

import {
  ReceiptsShell,
  type ReceiptHistoryItem,
} from "@/components/receipts/receipts-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";
import { displayText, finiteNumber, finiteNumberOrNull } from "@/lib/display";

export default async function ReceiptsPage() {
  const { organizationId, session } = await requireOnboardedCompany();
  const [organization, receipts] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.receipt.findMany({
      where: { businessId: organizationId },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      include: {
        supplier: { select: { name: true } },
        lines: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const history: ReceiptHistoryItem[] = receipts.map((receipt) => ({
    id: receipt.id,
    receiptDate: receipt.receiptDate.toISOString().slice(0, 10),
    supplier: displayText(receipt.supplier.name, "Supplier"),
    invoiceNumber: displayText(receipt.invoiceNumber, "") || null,
    fileName: displayText(receipt.fileName, "") || null,
    confidence: finiteNumberOrNull(receipt.confidence),
    vatAmount: finiteNumberOrNull(receipt.vatAmount),
    totalAmount: finiteNumberOrNull(receipt.totalAmount),
    currency: displayText(receipt.currency, "ILS"),
    status: displayText(receipt.status, "recorded"),
    lines: receipt.lines.map((line) => ({
      id: line.id,
      name: displayText(line.name, "Item"),
      description: displayText(line.description, "") || null,
      category: displayText(line.category, "") || null,
      supplierSku: displayText(line.supplierSku, "") || null,
      packageCount: finiteNumberOrNull(line.packageCount),
      unitsPerPackage: finiteNumberOrNull(line.unitsPerPackage),
      quantity: finiteNumber(line.quantity),
      unit: displayText(line.unit, "units"),
      packagePrice: finiteNumberOrNull(line.packagePrice),
      lineTotal: finiteNumberOrNull(line.lineTotal),
    })),
  }));

  return (
    <ReceiptsShell
      companyName={displayText(organization.name, "Company")}
      receipts={history}
      userName={displayText(session.user.name, "User")}
    />
  );
}
