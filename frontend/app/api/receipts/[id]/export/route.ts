import { prisma } from "@supply/database";
import { NextResponse } from "next/server";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { createReceiptWorkbook, excelResponse } from "@/lib/receipt-export";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId } = await requireApiCompany();
    const { id } = await params;
    const receipt = await prisma.receipt.findFirst({
      where: { id, businessId: organizationId },
      include: { supplier: { select: { name: true } }, lines: true },
    });
    if (!receipt)
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

    const rows = receipt.lines.map((line) => ({
      receiptKey: receipt.id,
      receiptDate: receipt.receiptDate.toISOString().slice(0, 10),
      supplier: receipt.supplier.name,
      invoiceNumber: receipt.invoiceNumber ?? "",
      vatAmount: receipt.vatAmount === null ? null : Number(receipt.vatAmount),
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
    }));
    const safeSupplier = receipt.supplier.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return excelResponse(
      createReceiptWorkbook(rows),
      `receipt-${safeSupplier || "supplier"}-${receipt.receiptDate.toISOString().slice(0, 10)}.xls`,
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to export receipt");
  }
}
