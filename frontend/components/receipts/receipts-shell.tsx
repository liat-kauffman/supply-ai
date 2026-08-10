"use client";

import {
  Building2,
  CalendarDays,
  FileSpreadsheet,
  FolderArchive,
  Hash,
  PackageCheck,
  ReceiptText,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { navigation } from "@/components/dashboard/dashboard-data";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  displayMoney,
  displayNumber,
  displayPercent,
  displayText,
  finiteNumber,
} from "@/lib/display";

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
    packageCount: number | null;
    unitsPerPackage: number | null;
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

function ReceiptDetails({ receipt }: { receipt: ReceiptHistoryItem }) {
  return (
    <div className="receipt-modal-content">
      <div className="receipt-modal-stats">
        <span>
          <small>Supplier</small>
          <strong>{displayText(receipt.supplier, "Supplier")}</strong>
        </span>
        <span>
          <small>Receipt date</small>
          <strong>
            {dateFormatter.format(new Date(`${receipt.receiptDate}T12:00:00Z`))}
          </strong>
        </span>
        <span>
          <small>Invoice</small>
          <strong>{displayText(receipt.invoiceNumber, "Not provided")}</strong>
        </span>
        <span>
          <small>Total</small>
          <strong>
            {displayMoney(
              receipt.totalAmount ??
                receipt.lines.reduce(
                  (sum, line) => sum + finiteNumber(line.lineTotal),
                  0,
                ),
              receipt.currency,
            )}
          </strong>
        </span>
      </div>
      <div className="receipt-table-wrap">
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Package price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <strong>{displayText(line.name, "Item")}</strong>
                  <small className="receipt-line-description">
                    {displayText(line.category, "Uncategorized")}
                  </small>
                </td>
                <td>
                  {line.packageCount !== null && line.unitsPerPackage !== null
                    ? `${displayNumber(line.packageCount)} packages × ${displayNumber(line.unitsPerPackage)} ${displayText(line.unit, "units")}`
                    : `${displayNumber(line.quantity)} ${displayText(line.unit, "units")}`}
                </td>
                <td>
                  {line.packagePrice === null
                    ? "—"
                    : displayMoney(line.packagePrice, receipt.currency)}
                </td>
                <td>
                  {line.lineTotal === null
                    ? "—"
                    : displayMoney(line.lineTotal, receipt.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="receipt-modal-footer">
        <span>
          {receipt.confidence === null
            ? "Reviewed import"
            : `${displayPercent(finiteNumber(receipt.confidence) * 100)} OCR confidence`}
        </span>
        {receipt.vatAmount !== null ? (
          <span>VAT {displayMoney(receipt.vatAmount, receipt.currency)}</span>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <a href={`/api/receipts/${receipt.id}/export`}>Download Excel</a>
        </Button>
      </div>
    </div>
  );
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
  const [selectedReceipt, setSelectedReceipt] =
    useState<ReceiptHistoryItem | null>(null);
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
      finiteNumber(
        receipt.totalAmount ??
          receipt.lines.reduce(
            (sum, line) => sum + finiteNumber(line.lineTotal),
            0,
          ),
      ),
    0,
  );
  const primaryCurrency = receipts[0]?.currency ?? "ILS";
  const supplierCount = new Set(receipts.map((receipt) => receipt.supplier))
    .size;

  return (
    <div className="app-shell receipts-shell">
      <Sidebar
        items={navigation}
        user={{ initials, name: userName, subtitle: companyName }}
      />
      <main className="receipts-main">
        <header className="receipts-header">
          <div>
            <p className="eyebrow">PURCHASE MEMORY</p>
            <h1>Receipts</h1>
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
              <strong>{displayMoney(totalValue, primaryCurrency)}</strong>
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
            <div className="receipt-history">
              {[...grouped.entries()].map(([date, dateReceipts]) => (
                <section className="receipt-date-group" key={date}>
                  <div className="receipt-date-heading">
                    <div className="receipt-date-badge">
                      <CalendarDays />
                    </div>
                    <div>
                      <h2>
                        {Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())
                          ? "Unknown date"
                          : dateFormatter.format(new Date(`${date}T12:00:00Z`))}
                      </h2>
                      <p>
                        {dateReceipts.length} receipt
                        {dateReceipts.length === 1 ? "" : "s"} imported
                      </p>
                    </div>
                    <span>
                      {displayMoney(
                        dateReceipts.reduce(
                          (sum, receipt) =>
                            sum +
                            (receipt.totalAmount ??
                              receipt.lines.reduce(
                                (lineSum, line) =>
                                  lineSum + finiteNumber(line.lineTotal),
                                0,
                              )),
                          0,
                        ),
                        dateReceipts[0]?.currency ?? primaryCurrency,
                      )}
                    </span>
                  </div>
                  <div className="receipt-cards">
                    {dateReceipts.map((receipt) => {
                      const receiptTotal =
                        receipt.totalAmount ??
                        receipt.lines.reduce(
                          (sum, line) => sum + finiteNumber(line.lineTotal),
                          0,
                        );
                      return (
                        <details
                          className="receipt-card"
                          key={receipt.id}
                          onClick={(event) => {
                            event.preventDefault();
                            setSelectedReceipt(receipt);
                          }}
                        >
                          <summary>
                            <span className="receipt-supplier-mark">
                              {displayText(receipt.supplier, "S")
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                            <span className="receipt-identity">
                              <strong>
                                {displayText(receipt.supplier, "Supplier")}
                              </strong>
                              <small>
                                {displayText(receipt.invoiceNumber, "")
                                  ? `Invoice ${displayText(receipt.invoiceNumber)}`
                                  : displayText(
                                      receipt.fileName,
                                      "Receipt import",
                                    )}
                              </small>
                              <span className="receipt-source-meta">
                                <span>
                                  <FolderArchive />
                                  {displayText(
                                    receipt.fileName,
                                    "Imported scan",
                                  )}
                                </span>
                                <span>
                                  <Hash />
                                  {displayText(
                                    receipt.invoiceNumber,
                                    "No invoice number",
                                  )}
                                </span>
                              </span>
                            </span>
                            <span className="receipt-meta">
                              <Badge className="receipt-status-badge">
                                {displayText(
                                  receipt.status,
                                  "recorded",
                                ).toLowerCase()}
                              </Badge>
                              <small>{receipt.lines.length} lines</small>
                              {receipt.vatAmount !== null ? (
                                <small>
                                  VAT{" "}
                                  {displayMoney(
                                    receipt.vatAmount,
                                    receipt.currency,
                                  )}
                                </small>
                              ) : null}
                              {receipt.totalAmount !== null ? (
                                <small>
                                  Total{" "}
                                  {displayMoney(
                                    receipt.totalAmount,
                                    receipt.currency,
                                  )}
                                </small>
                              ) : null}
                              <small>
                                {receipt.confidence === null
                                  ? "Reviewed"
                                  : `${displayPercent(
                                      finiteNumber(receipt.confidence) * 100,
                                    )} OCR`}
                              </small>
                            </span>
                            <strong className="receipt-total">
                              {displayMoney(receiptTotal, receipt.currency)}
                            </strong>
                          </summary>
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
      {selectedReceipt ? (
        <div
          className="inventory-modal-backdrop"
          onMouseDown={() => setSelectedReceipt(null)}
        >
          <section
            aria-labelledby="receipt-detail-title"
            aria-modal="true"
            className="inventory-modal receipt-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="inventory-modal-heading">
              <div>
                <p className="eyebrow">RECEIPT DETAILS</p>
                <h2 id="receipt-detail-title">
                  {displayText(selectedReceipt.supplier, "Supplier")}
                </h2>
                <span>
                  {displayText(selectedReceipt.fileName, "Imported receipt")}
                </span>
              </div>
              <Button
                aria-label="Close receipt details"
                onClick={() => setSelectedReceipt(null)}
                size="icon"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
            <ReceiptDetails receipt={selectedReceipt} />
          </section>
        </div>
      ) : null}
      <MobileNavigation
        items={navigation.map(({ label, href, icon }) => ({
          label,
          href,
          icon,
        }))}
      />
    </div>
  );
}
