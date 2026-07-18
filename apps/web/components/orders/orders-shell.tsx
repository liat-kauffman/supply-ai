"use client";

import { AlertTriangle, PackageOpen, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { navigation } from "@/components/dashboard/dashboard-data";
import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayMoney, displayNumber, displayText } from "@/lib/display";
import type { OrdersData } from "@/lib/orders";

function quantity(value: number) {
  return displayNumber(value, { maximumFractionDigits: 1 });
}

export function OrdersShell({
  companyName,
  orders,
  userName,
}: {
  companyName: string;
  orders: OrdersData;
  userName: string;
}) {
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell orders-shell">
      <Sidebar
        items={navigation}
        activeHref="/orders"
        onNavigate={() => undefined}
        user={{ initials, name: userName, subtitle: companyName }}
      />
      <main className="orders-main">
        <header className="orders-header">
          <div>
            <p className="eyebrow">SUPPLIER BASKETS</p>
            <h1>Orders</h1>
            <p className="subtitle">
              Items fall into supplier baskets automatically when stock drops
              below minimum. Recommendations use the last receipt and how much
              was actually used since then.
            </p>
          </div>
          <Button asChild className="primary receipt-action-button" size="sm">
            <Link href="/receipts/import">Import latest receipt</Link>
          </Button>
        </header>

        <section className="orders-summary" aria-label="Order summary">
          <article>
            <span className="orders-summary-icon neutral">
              <ShoppingBag />
            </span>
            <div>
              <strong>{displayNumber(orders.summary.supplierCount)}</strong>
              <small>supplier baskets</small>
            </div>
          </article>
          <article>
            <span className="orders-summary-icon review">
              <PackageOpen />
            </span>
            <div>
              <strong>{displayNumber(orders.summary.itemCount)}</strong>
              <small>items to reorder</small>
            </div>
          </article>
          <article>
            <span className="orders-summary-icon warning">
              <AlertTriangle />
            </span>
            <div>
              <strong>{displayNumber(orders.summary.criticalCount)}</strong>
              <small>completely out of stock</small>
            </div>
          </article>
          <article>
            <span className="orders-summary-icon success">
              <ShoppingBag />
            </span>
            <div>
              <strong>
                {displayMoney(orders.summary.basketValue, orders.currency)}
              </strong>
              <small>estimated basket value</small>
            </div>
          </article>
        </section>

        {orders.baskets.length ? (
          <section className="orders-baskets">
            {orders.baskets.map((basket) => (
              <article className="order-basket-card" key={basket.supplierId}>
                <header className="order-basket-header">
                  <div className="order-basket-identity">
                    <span className="order-basket-logo">{basket.logo}</span>
                    <div>
                      <h2>{displayText(basket.supplierName, "Supplier")}</h2>
                      <p>
                        {basket.deliveryLabel} · cutoff {basket.cutoffLabel}
                      </p>
                    </div>
                  </div>
                  <div className="order-basket-meta">
                    <Badge variant="outline">
                      {displayNumber(basket.itemCount)} items
                    </Badge>
                    <strong>
                      {displayMoney(basket.basketValue, basket.currency)}
                    </strong>
                    <small>
                      {basket.minimumValue > 0
                        ? basket.remainingValue > 0
                          ? `${displayMoney(
                              basket.remainingValue,
                              basket.currency,
                            )} below supplier target`
                          : "Basket reached supplier target"
                        : "No supplier minimum set"}
                    </small>
                  </div>
                </header>

                <div className="order-basket-table-wrap">
                  <table className="order-basket-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>On hand</th>
                        <th>Minimum</th>
                        <th>Used since last receipt</th>
                        <th>Recommended order</th>
                        <th>Packages</th>
                        <th>Estimated cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {basket.items.map((item) => (
                        <tr key={item.productId}>
                          <td>
                            <strong>
                              {displayText(item.productName, "Item")}
                            </strong>
                            <small>
                              {displayText(item.supplierSku, "")
                                ? `SKU ${displayText(item.supplierSku)}`
                                : "No supplier SKU"}
                              {" · "}
                              {item.lastReceiptDate
                                ? `last receipt ${item.lastReceiptDate}`
                                : "no receipt history yet"}
                              {item.lastReceiptQuantity !== null
                                ? ` · last qty ${quantity(item.lastReceiptQuantity)} ${displayText(item.unit, "units")}`
                                : ""}
                            </small>
                          </td>
                          <td>
                            {quantity(item.currentQuantity)}{" "}
                            {displayText(item.unit, "units")}
                          </td>
                          <td>
                            {quantity(item.minimumQuantity)}{" "}
                            {displayText(item.unit, "units")}
                          </td>
                          <td>
                            {quantity(item.usageSinceLastReceipt)}{" "}
                            {displayText(item.unit, "units")}
                          </td>
                          <td>
                            {quantity(item.recommendedQuantity)}{" "}
                            {displayText(item.unit, "units")}
                            <small>
                              shortage {quantity(item.shortageQuantity)}{" "}
                              {displayText(item.unit, "units")}
                            </small>
                          </td>
                          <td>
                            {displayNumber(item.packageCount)} ×{" "}
                            {quantity(item.unitsPerPackage)}{" "}
                            {displayText(item.unit, "units")}
                          </td>
                          <td>
                            {item.estimatedCost === null
                              ? "—"
                              : displayMoney(
                                  item.estimatedCost,
                                  basket.currency,
                                )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="orders-empty">
            <span>
              <ShoppingBag />
            </span>
            <h2>No supplier baskets yet</h2>
            <p>
              Once an active inventory item drops below its minimum and has a
              linked supplier, it will appear here automatically.
            </p>
          </section>
        )}
      </main>
      <MobileNavigation
        activeHref="/orders"
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
