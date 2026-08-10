import { prisma } from "@supply/database";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { excelResponse } from "@/lib/receipt-export";

function escapeXml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cell(value: string | number) {
  return `<Cell><Data ss:Type="${typeof value === "number" ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`;
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireApiCompany();
    const report = new URL(request.url).searchParams.get("report");
    if (report === "suppliers") {
      const suppliers = await prisma.supplier.findMany({
        where: { businessId: organizationId, active: true },
        include: {
          receipts: {
            select: {
              totalAmount: true,
              lines: { select: { lineTotal: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
      const rows = suppliers.map((supplier) => {
        const spend = supplier.receipts.reduce(
          (sum, receipt) =>
            sum +
            (receipt.totalAmount === null
              ? receipt.lines.reduce(
                  (lineSum, line) => lineSum + Number(line.lineTotal ?? 0),
                  0,
                )
              : Number(receipt.totalAmount)),
          0,
        );
        return [
          supplier.name,
          supplier.receipts.length,
          spend,
          supplier.currency,
          supplier.orderDays.join(", "),
        ];
      });
      const header = [
        "Supplier",
        "Receipts",
        "Recorded spend",
        "Currency",
        "Order weekdays",
      ];
      const xmlRows = [header, ...rows]
        .map((row) => `<Row>${row.map(cell).join("")}</Row>`)
        .join("");
      const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="AI Supplier Report"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
      return excelResponse(
        workbook,
        `supplai-ai-supplier-report-${new Date().toISOString().slice(0, 10)}.xls`,
      );
    }
    const [profile, products] = await Promise.all([
      prisma.businessProfile.findUnique({
        where: { id: organizationId },
        select: { currency: true },
      }),
      prisma.product.findMany({
        where: { businessId: organizationId, active: true },
        include: {
          movements: { select: { quantityDelta: true } },
          supplierProducts: {
            where: { isPreferred: true },
            take: 1,
            include: { supplier: { select: { name: true } } },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    const currency = profile?.currency ?? "ILS";
    const rows = products.map((product) => {
      const quantity = product.movements.reduce(
        (sum, movement) => sum + Number(movement.quantityDelta),
        0,
      );
      const minimum = Number(product.minimumStock);
      return [
        product.name,
        product.category ?? "Uncategorized",
        product.supplierProducts[0]?.supplier.name ?? "No supplier",
        quantity,
        minimum,
        quantity < minimum ? "Low stock" : "Healthy",
        product.baseUnit,
        currency,
      ];
    });
    const header = [
      "Item",
      "Category",
      "Preferred supplier",
      "On hand",
      "Minimum",
      "Status",
      "Unit",
      "Currency",
    ];
    const xmlRows = [header, ...rows]
      .map((row) => `<Row>${row.map(cell).join("")}</Row>`)
      .join("");
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="AI Inventory Report"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
    return excelResponse(
      workbook,
      `supplai-ai-inventory-report-${new Date().toISOString().slice(0, 10)}.xls`,
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to create the Excel report");
  }
}
