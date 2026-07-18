"use client";

import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FolderArchive,
  Hash,
  PackageCheck,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { navigation } from "@/components/dashboard/dashboard-data";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ReceiptHistoryItem {
  id: string;
  receiptDate: string;
  supplier: string;
  invoiceNumber: string | null;
  fileName: string | null;
  confidence: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  lines: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    supplierSku: string | null;
    quantity: number;
    unit: string;
    packagePrice: number | null;
    lineTotal: number | null;
  }>;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ReceiptsShell({
  companyName,
  userName,
  receipts,
}: {
  companyName: string;
  userName: string;
  receipts: ReceiptHistoryItem[];
}) {
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const grouped = receipts.reduce<Map<string, ReceiptHistoryItem[]>>(
    (groups, receipt) => {
      const current = groups.get(receipt.receiptDate) ?? [];
      current.push(receipt);
      groups.set(receipt.receiptDate, current);
      return groups;
    },
    new Map(),
  );
  const lineCount = receipts.reduce(
    (total, receipt) => total + receipt.lines.length,
    0,
  );
  const totalValue = receipts.reduce(
    (total, receipt) =>
      total +
      (receipt.totalAmount ??
        receipt.lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0)),
    0,
  );
  const primaryCurrency = receipts[0]?.currency ?? "ILS";
  const supplierCount = new Set(receipts.map((receipt) => receipt.supplier))
    .size;
  const averageConfidence = receipts.length
    ? Math.round(
        (receipts.reduce(
          (total, receipt) => total + (receipt.confidence ?? 1),
          0,
        ) /
          receipts.length) *
          100,
      )
    : 0;

  return (
    <div className="app-shell receipts-shell">
      <Sidebar
        items={navigation}
        activeHref="/receipts"
        onNavigate={() => undefined}
        user={{ initials, name: userName, subtitle: companyName }}
      />
      <main className="receipts-main">
        <header className="receipts-header">
          <div>
            <p className="eyebrow">PURCHASE MEMORY</p>
            <h1>Receipts</h1>
            <p className="subtitle">
              OCR imports are stored by date and connected to suppliers,
              inventory, and price history.
            </p>
          </div>
          <div className="receipts-actions">
            {receipts.length ? (
              <Button
                asChild
                className="receipt-action-button"
                size="sm"
                variant="outline"
              >
                <a href="/api/receipts/export">
                  <FileSpreadsheet /> Export all to Excel
                </a>
              </Button>
            ) : null}
            <Button asChild className="primary receipt-action-button" size="sm">
              <Link href="/receipts/import">
                <Sparkles /> Scan supplier receipt
              </Link>
            </Button>
          </div>
        </header>

        <section className="receipts-summary" aria-label="Receipt summary">
          <article>
            <span className="receipts-summary-icon neutral">
              <ReceiptText />
            </span>
            <div>
              <strong>{receipts.length}</strong>
              <small>saved receipts</small>
            </div>
          </article>
          <article>
            <span className="receipts-summary-icon review">
              <PackageCheck />
            </span>
            <div>
              <strong>{lineCount}</strong>
              <small>inventory lines</small>
            </div>
          </article>
          <article>
            <span className="receipts-summary-icon warning">
              <FileSpreadsheet />
            </span>
            <div>
              <strong>{money(totalValue, primaryCurrency)}</strong>
              <small>recorded purchase value</small>
            </div>
          </article>
          <article>
            <span className="receipts-summary-icon success">
              <Building2 />
            </span>
            <div>
              <strong>{supplierCount}</strong>
              <small>active suppliers in memory</small>
            </div>
          </article>
        </section>

        {receipts.length ? (
          <section className="receipts-workspace">
            <div className="receipts-overview-card">
              <div>
                <p className="eyebrow">LATEST IMPORTS</p>
                <h2>Receipt history at a glance</h2>
                <p>
                  Every approved receipt keeps supplier, invoice, quantity, and
                  price context together for later review and export.
                </p>
              </div>
              <div className="receipts-overview-stats">
                <article>
                  <small>OCR confidence</small>
                  <strong>{averageConfidence}%</strong>
                  <span>Average across saved receipts</span>
                </article>
                <article>
                  <small>Suppliers captured</small>
                  <strong>{supplierCount}</strong>
                  <span>Distinct vendors represented</span>
                </article>
              </div>
            </div>

            <div className="receipt-history">
              {[...grouped.entries()].map(([date, dateReceipts]) => (
                <section className="receipt-date-group" key={date}>
                  <div className="receipt-date-heading">
                    <div className="receipt-date-badge">
                      <CalendarDays />
                    </div>
                    <div>
                      <h2>
                        {dateFormatter.format(new Date(`${date}T12:00:00Z`))}
                      </h2>
                      <p>
                        {dateReceipts.length} receipt
                        {dateReceipts.length === 1 ? "" : "s"} imported
                      </p>
                    </div>
                    <span>
                      {money(
                        dateReceipts.reduce(
                          (sum, receipt) =>
                            sum +
                            (receipt.totalAmount ??
                              receipt.lines.reduce(
                                (lineSum, line) =>
                                  lineSum + (line.lineTotal ?? 0),
                                0,
                              )),
                          0,
                        ),
                        dateReceipts[0]?.currency ?? primaryCurrency,
                      )}
                    </span>
                  </div>
                  <div className="receipt-cards">
                    {dateReceipts.map((receipt, index) => {
                      const receiptTotal =
                        receipt.totalAmount ??
                        receipt.lines.reduce(
                          (sum, line) => sum + (line.lineTotal ?? 0),
                          0,
                        );
                      return (
                        <details
                          className="receipt-card"
                          key={receipt.id}
                          open={index === 0}
                        >
                          <summary>
                            <span className="receipt-supplier-mark">
                              {receipt.supplier.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="receipt-identity">
                              <strong>{receipt.supplier}</strong>
                              <small>
                                {receipt.invoiceNumber
                                  ? `Invoice ${receipt.invoiceNumber}`
                                  : (receipt.fileName ?? "Receipt import")}
                              </small>
                              <span className="receipt-source-meta">
                                <span>
                                  <FolderArchive />
                                  {receipt.fileName ?? "Imported scan"}
                                </span>
                                <span>
                                  <Hash />
                                  {receipt.invoiceNumber ?? "No invoice number"}
                                </span>
                              </span>
                            </span>
                            <span className="receipt-meta">
                              <Badge className="receipt-status-badge">
                                {receipt.status.toLowerCase()}
                              </Badge>
                              <small>{receipt.lines.length} lines</small>
                              {receipt.vatAmount !== null ? (
                                <small>
                                  VAT{" "}
                                  {money(receipt.vatAmount, receipt.currency)}
                                </small>
                              ) : null}
                              {receipt.totalAmount !== null ? (
                                <small>
                                  Total{" "}
                                  {money(receipt.totalAmount, receipt.currency)}
                                </small>
                              ) : null}
                              <small>
                                {receipt.confidence === null
                                  ? "Reviewed"
                                  : `${Math.round(receipt.confidence * 100)}% OCR`}
                              </small>
                            </span>
                            <strong className="receipt-total">
                              {money(receiptTotal, receipt.currency)}
                            </strong>
                          </summary>
                          <div className="receipt-card-body">
                            <div className="receipt-line-chips">
                              {receipt.lines.slice(0, 4).map((line) => (
                                <span key={line.id}>
                                  {line.name}
                                  <small>
                                    {line.quantity} {line.unit}
                                  </small>
                                </span>
                              ))}
                              {receipt.lines.length > 4 ? (
                                <em>+{receipt.lines.length - 4} more items</em>
                              ) : null}
                            </div>
                            <div className="receipt-table-wrap">
                              <table className="receipt-table">
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>SKU</th>
                                    <th>Quantity</th>
                                    <th>Package price</th>
                                    <th>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {receipt.lines.map((line) => (
                                    <tr key={line.id}>
                                      <td>
                                        <strong>{line.name}</strong>
                                        {line.description ? (
                                          <small className="receipt-line-description">
                                            {line.description}
                                          </small>
                                        ) : null}
                                      </td>
                                      <td>{line.category || "—"}</td>
                                      <td>{line.supplierSku || "—"}</td>
                                      <td>
                                        {line.quantity} {line.unit}
                                      </td>
                                      <td>
                                        {line.packagePrice === null
                                          ? "—"
                                          : money(
                                              line.packagePrice,
                                              receipt.currency,
                                            )}
                                      </td>
                                      <td>
                                        {line.lineTotal === null
                                          ? "—"
                                          : money(
                                              line.lineTotal,
                                              receipt.currency,
                                            )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="receipt-card-footer">
                              <span>
                                {receipt.confidence === null
                                  ? "Reviewed import"
                                  : `${Math.round(receipt.confidence * 100)}% OCR confidence`}
                              </span>
                              {receipt.vatAmount !== null ? (
                                <span>
                                  VAT{" "}
                                  {money(receipt.vatAmount, receipt.currency)}
                                </span>
                              ) : null}
                              {receipt.totalAmount !== null ? (
                                <span>
                                  Total{" "}
                                  {money(receipt.totalAmount, receipt.currency)}
                                </span>
                              ) : null}
                              <span className="receipt-card-footer-total">
                                <BadgeCheck />
                                Synced to inventory memory
                              </span>
                              <Button asChild size="sm" variant="outline">
                                <a href={`/api/receipts/${receipt.id}/export`}>
                                  <Download /> Download Excel
                                </a>
                              </Button>
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ) : (
          <section className="receipts-empty">
            <span>
              <ReceiptText />
            </span>
            <h2>Your receipt memory starts here</h2>
            <p>
              Upload one receipt for each supplier. Supplai will extract the
              lines for your review before updating inventory.
            </p>
            <Button asChild className="primary receipt-action-button" size="sm">
              <Link href="/receipts/import">Upload first receipt</Link>
            </Button>
          </section>
        )}
      </main>
      <MobileNavigation
        activeHref="/receipts"
        items={navigation.map(({ label, href, icon }) => ({
          label,
          href,
          icon,
        }))}
        onNavigate={() => undefined}
      />
    </div>
  );
}
