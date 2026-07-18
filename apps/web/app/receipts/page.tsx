import { prisma } from "@supply/database";

import {
  ReceiptsShell,
  type ReceiptHistoryItem,
} from "@/components/receipts/receipts-shell";
import { requireOnboardedCompany } from "@/lib/auth/server";

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
    supplier: receipt.supplier.name,
    invoiceNumber: receipt.invoiceNumber,
    fileName: receipt.fileName,
    confidence: receipt.confidence === null ? null : Number(receipt.confidence),
    vatAmount: receipt.vatAmount === null ? null : Number(receipt.vatAmount),
    totalAmount:
      receipt.totalAmount === null ? null : Number(receipt.totalAmount),
    currency: receipt.currency,
    status: receipt.status,
    lines: receipt.lines.map((line) => ({
      id: line.id,
      name: line.name,
      description: line.description,
      category: line.category,
      supplierSku: line.supplierSku,
      quantity: Number(line.quantity),
      unit: line.unit,
      packagePrice:
        line.packagePrice === null ? null : Number(line.packagePrice),
      lineTotal: line.lineTotal === null ? null : Number(line.lineTotal),
    })),
  }));

  return (
    <ReceiptsShell
      companyName={organization.name}
      receipts={history}
      userName={session.user.name}
    />
  );
}
