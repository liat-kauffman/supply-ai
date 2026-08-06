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
                    {dateReceipts.map((receipt, index) => {
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
                          open={index === 0}
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
                          <div className="receipt-card-body">
                            <div className="receipt-line-chips">
                              {receipt.lines.slice(0, 4).map((line) => (
                                <span key={line.id}>
                                  {displayText(line.name, "Item")}
                                  <small>
                                    {line.packageCount !== null &&
                                    line.unitsPerPackage !== null ? (
                                      <>
                                        {displayNumber(line.packageCount)} ×{" "}
                                        {displayNumber(line.unitsPerPackage)}{" "}
                                        {displayText(line.unit, "units")}
                                      </>
                                    ) : (
                                      <>
                                        {displayNumber(line.quantity)}{" "}
                                        {displayText(line.unit, "units")}
                                      </>
                                    )}
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
                                        <strong>
                                          {displayText(line.name, "Item")}
                                        </strong>
                                        {displayText(line.description, "") ? (
                                          <small className="receipt-line-description">
                                            {displayText(line.description)}
                                          </small>
                                        ) : null}
                                      </td>
                                      <td>{displayText(line.category)}</td>
                                      <td>{displayText(line.supplierSku)}</td>
                                      <td>
                                        {line.packageCount !== null &&
                                        line.unitsPerPackage !== null ? (
                                          <>
                                            {displayNumber(line.packageCount)}{" "}
                                            packages ×{" "}
                                            {displayNumber(
                                              line.unitsPerPackage,
                                            )}{" "}
                                            {displayText(line.unit, "units")}
                                            <small className="receipt-line-description">
                                              {displayNumber(line.quantity)}{" "}
                                              total
                                            </small>
                                          </>
                                        ) : (
                                          <>
                                            {displayNumber(line.quantity)}{" "}
                                            {displayText(line.unit, "units")}
                                          </>
                                        )}
                                      </td>
                                      <td>
                                        {line.packagePrice === null
                                          ? "—"
                                          : displayMoney(
                                              line.packagePrice,
                                              receipt.currency,
                                            )}
                                      </td>
                                      <td>
                                        {line.lineTotal === null
                                          ? "—"
                                          : displayMoney(
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
                                  : `${displayPercent(
                                      finiteNumber(receipt.confidence) * 100,
                                    )} OCR confidence`}
                              </span>
                              {receipt.vatAmount !== null ? (
                                <span>
                                  VAT{" "}
                                  {displayMoney(
                                    receipt.vatAmount,
                                    receipt.currency,
                                  )}
                                </span>
                              ) : null}
                              {receipt.totalAmount !== null ? (
                                <span>
                                  Total{" "}
                                  {displayMoney(
                                    receipt.totalAmount,
                                    receipt.currency,
                                  )}
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
        items={navigation.map(({ label, href, icon }) => ({
          label,
          href,
          icon,
        }))}
      />
    </div>
  );
}
