import { prisma } from "@supply/database";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import {
  createReceiptWorkbook,
  excelResponse,
  type ReceiptExportRow,
} from "@/lib/receipt-export";

export async function GET() {
  try {
    const { organizationId } = await requireApiCompany();
    const receipts = await prisma.receipt.findMany({
      where: { businessId: organizationId },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      include: { supplier: { select: { name: true } }, lines: true },
    });
    const rows: ReceiptExportRow[] = receipts.flatMap((receipt) =>
      receipt.lines.map((line) => ({
        receiptKey: receipt.id,
        receiptDate: receipt.receiptDate.toISOString().slice(0, 10),
        supplier: receipt.supplier.name,
        invoiceNumber: receipt.invoiceNumber ?? "",
        vatAmount:
          receipt.vatAmount === null ? null : Number(receipt.vatAmount),
        totalAmount:
          receipt.totalAmount === null ? null : Number(receipt.totalAmount),
        item: line.name,
        description: line.description ?? "",
        category: line.category ?? "",
        supplierSku: line.supplierSku ?? "",
        packageCount:
          line.packageCount === null ? null : Number(line.packageCount),
        unitsPerPackage:
          line.unitsPerPackage === null ? null : Number(line.unitsPerPackage),
        quantity: Number(line.quantity),
        unit: line.unit,
        packagePrice:
          line.packagePrice === null ? null : Number(line.packagePrice),
        lineTotal: line.lineTotal === null ? null : Number(line.lineTotal),
        currency: receipt.currency,
      })),
    );
    return excelResponse(
      createReceiptWorkbook(rows, { includeGrandTotal: true }),
      `supplai-receipts-${new Date().toISOString().slice(0, 10)}.xls`,
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to export receipts");
  }
}
