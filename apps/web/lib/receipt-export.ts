export interface ReceiptExportRow {
  receiptKey?: string;
  receiptDate: string;
  supplier: string;
  invoiceNumber: string;
  vatAmount: number | null;
  totalAmount: number | null;
  item: string;
  description: string;
  category: string;
  supplierSku: string;
  quantity: number;
  unit: string;
  packagePrice: number | null;
  lineTotal: number | null;
  currency: string;
}

type ReceiptExportColumnKey = Exclude<keyof ReceiptExportRow, "receiptKey">;
type ReceiptWorkbookRow = ReceiptExportRow & {
  totalWithTax: number | null;
};

const columns: Array<{
  label: string;
  key: ReceiptExportColumnKey | "totalWithTax";
  type?: "Number";
}> = [
  { label: "Receipt date", key: "receiptDate" },
  { label: "Supplier", key: "supplier" },
  { label: "Invoice number", key: "invoiceNumber" },
  { label: "VAT amount", key: "vatAmount", type: "Number" },
  { label: "Item", key: "item" },
  { label: "Description", key: "description" },
  { label: "Category", key: "category" },
  { label: "Supplier SKU", key: "supplierSku" },
  { label: "Quantity", key: "quantity", type: "Number" },
  { label: "Unit", key: "unit" },
  { label: "Package price", key: "packagePrice", type: "Number" },
  { label: "Line total", key: "lineTotal", type: "Number" },
  { label: "Total incl. tax", key: "totalWithTax", type: "Number" },
  { label: "Currency", key: "currency" },
];

function escapeXml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cell(value: string | number | null, type: "String" | "Number") {
  if (value === null || value === "")
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function groupedReceiptKey(row: ReceiptExportRow) {
  return (
    row.receiptKey ??
    `${row.receiptDate}::${row.supplier}::${row.invoiceNumber}`
  );
}

function workbookRow(
  row: ReceiptExportRow,
  receiptSubtotal: number,
  receiptTotal: number | null,
): ReceiptWorkbookRow {
  const targetVat =
    row.vatAmount ??
    (receiptTotal !== null ? receiptTotal - receiptSubtotal : null);
  const vatShare =
    row.lineTotal === null || targetVat === null
      ? null
      : receiptSubtotal > 0
        ? Number(((row.lineTotal / receiptSubtotal) * targetVat).toFixed(2))
        : 0;
  const totalWithTax =
    row.lineTotal === null || vatShare === null
      ? null
      : Number((row.lineTotal + vatShare).toFixed(2));
  return {
    ...row,
    totalWithTax,
  };
}

function rowXml(row: ReceiptWorkbookRow) {
  return `<Row>${columns
    .map((column) => cell(row[column.key], column.type ?? "String"))
    .join("")}</Row>`;
}

function summaryRow(
  label: string,
  subtotal: number,
  vatAmount: number,
  totalAmount: number,
  currency: string,
) {
  return `<Row>${[
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell(vatAmount, "Number"),
    cell(label, "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell("", "String"),
    cell(subtotal, "Number"),
    cell(totalAmount, "Number"),
    cell(currency, "String"),
  ].join("")}</Row>`;
}

export function createReceiptWorkbook(
  rows: ReceiptExportRow[],
  options?: { includeGrandTotal?: boolean },
) {
  const header = columns.map((column) => cell(column.label, "String")).join("");
  let grandTotal = 0;
  const bodyParts: string[] = [];
  const groups = new Map<string, ReceiptExportRow[]>();

  for (const row of rows) {
    const key = groupedReceiptKey(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  for (const groupRows of groups.values()) {
    const receiptSubtotal = groupRows.reduce(
      (total, row) => total + (row.lineTotal ?? 0),
      0,
    );
    const receiptVat = groupRows[0]?.vatAmount ?? 0;
    const storedReceiptTotal = groupRows[0]?.totalAmount ?? null;
    const normalizedTotalWithVat =
      storedReceiptTotal ?? receiptSubtotal + receiptVat;
    for (const row of groupRows) {
      const exportRow = workbookRow(row, receiptSubtotal, storedReceiptTotal);
      bodyParts.push(rowXml(exportRow));
    }
    grandTotal += normalizedTotalWithVat;
    bodyParts.push(
      summaryRow(
        "Receipt total",
        Number(receiptSubtotal.toFixed(2)),
        Number(receiptVat.toFixed(2)),
        Number(normalizedTotalWithVat.toFixed(2)),
        groupRows[0]?.currency ?? "ILS",
      ),
    );
  }

  if (options?.includeGrandTotal && rows.length) {
    const grandSubtotal = rows.reduce(
      (total, row) => total + (row.lineTotal ?? 0),
      0,
    );
    const grandVat = [...groups.values()].reduce(
      (total, groupRows) => total + (groupRows[0]?.vatAmount ?? 0),
      0,
    );
    bodyParts.push(
      summaryRow(
        "Combined total",
        Number(grandSubtotal.toFixed(2)),
        Number(grandVat.toFixed(2)),
        Number(grandTotal.toFixed(2)),
        rows[0]?.currency ?? "ILS",
      ),
    );
  }

  const body = bodyParts.join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Receipts"><Table><Row>${header}</Row>${body}</Table></Worksheet>
</Workbook>`;
}

export function excelResponse(workbook: string, fileName: string) {
  return new Response(workbook, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
    },
  });
}
