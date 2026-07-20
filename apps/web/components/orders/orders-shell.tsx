"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  LoaderCircle,
  PackageOpen,
  Plus,
  Save,
  Send,
  ShoppingBag,
  Trash2,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { navigation } from "@/components/dashboard/dashboard-data";
import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayMoney, displayNumber, displayText } from "@/lib/display";
import type {
  OrderApprovalCatalogItem,
  OrderApprovalLine,
  OrderApprovalRequest,
  OrderCatalog,
  OrdersData,
  SupplierBasket,
} from "@/lib/orders";

interface EditableReviewItem {
  productId: string;
  productName: string;
  supplierSku: string | null;
  unit: string;
  unitsPerPackage: number;
  latestPackagePrice: number | null;
  packageCount: number;
  requestedQuantity: number;
}

function editableLine(line: OrderApprovalLine): EditableReviewItem {
  return {
    productId: line.productId,
    productName: line.productName,
    supplierSku: line.supplierSku,
    unit: line.unit,
    unitsPerPackage: line.unitsPerPackage,
    latestPackagePrice: line.latestPackagePrice,
    packageCount: line.packageCount,
    requestedQuantity: line.requestedQuantity,
  };
}

function editableCatalogItem(
  item: OrderApprovalCatalogItem,
): EditableReviewItem {
  return {
    ...item,
    packageCount: 1,
    requestedQuantity: item.unitsPerPackage,
  };
}

function quantity(value: number) {
  return displayNumber(value, { maximumFractionDigits: 1 });
}

function requestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function approvedList(request: OrderApprovalRequest) {
  const lines = request.lines
    .filter((line) => line.packageCount > 0)
    .map((line) => {
      const sku = line.supplierSku ? ` · SKU ${line.supplierSku}` : "";
      return `${line.productName}: ${line.packageCount} package${line.packageCount === 1 ? "" : "s"} (${quantity(line.requestedQuantity)} ${line.unit})${sku}`;
    });
  return [
    `Order for ${request.supplierName}`,
    `Prepared from ${request.requesterName}'s basket`,
    "",
    ...lines,
  ].join("\n");
}

export function OrdersShell({
  approvalRequests,
  companyName,
  currentRole,
  orders,
  userName,
}: {
  approvalRequests: OrderApprovalRequest[];
  companyName: string;
  currentRole: string;
  orders: OrdersData;
  userName: string;
}) {
  const router = useRouter();
  const canReview = currentRole === "owner" || currentRole === "manager";
  const isEmployee = currentRole === "employee";
  const pendingRequests = approvalRequests.filter(
    (request) => request.status === "PENDING",
  );
  const approvedRequests = approvalRequests.filter(
    (request) => request.status === "APPROVED",
  );
  const [basketCounts, setBasketCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      orders.baskets.flatMap((basket) =>
        basket.items.map((item) => [
          `${basket.supplierId}:${item.productId}`,
          item.packageCount,
        ]),
      ),
    ),
  );
  const [reviewItems, setReviewItems] = useState<
    Record<string, EditableReviewItem[]>
  >(() =>
    Object.fromEntries(
      pendingRequests.map((request) => [
        request.id,
        request.lines.map(editableLine),
      ]),
    ),
  );
  const [catalogSelections, setCatalogSelections] = useState<
    Record<string, string>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pendingRequests.map((request) => [request.id, request.note ?? ""]),
    ),
  );
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState(
    orders.catalogs[0]?.supplierId ?? "",
  );
  const [newItems, setNewItems] = useState<EditableReviewItem[]>([]);
  const [newItemSelection, setNewItemSelection] = useState("");
  const [newOrderNote, setNewOrderNote] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setReviewItems((current) => {
      const next = { ...current };
      for (const request of approvalRequests) {
        if (request.status === "PENDING" && !next[request.id]) {
          next[request.id] = request.lines.map(editableLine);
        }
      }
      return next;
    });
    setReviewNotes((current) => ({
      ...Object.fromEntries(
        approvalRequests
          .filter((request) => request.status === "PENDING")
          .map((request) => [request.id, request.note ?? ""]),
      ),
      ...current,
    }));
  }, [approvalRequests]);

  const newOrderCatalog = orders.catalogs.find(
    (catalog) => catalog.supplierId === newSupplierId,
  );

  function countFor(basket: SupplierBasket, productId: string) {
    return basketCounts[`${basket.supplierId}:${productId}`] ?? 0;
  }

  function updateReviewItem(
    requestId: string,
    productId: string,
    update: Partial<EditableReviewItem>,
  ) {
    setReviewItems((current) => ({
      ...current,
      [requestId]: (current[requestId] ?? []).map((item) =>
        item.productId === productId ? { ...item, ...update } : item,
      ),
    }));
  }

  function removeReviewItem(requestId: string, productId: string) {
    setReviewItems((current) => ({
      ...current,
      [requestId]: (current[requestId] ?? []).filter(
        (item) => item.productId !== productId,
      ),
    }));
  }

  function addReviewItem(request: OrderApprovalRequest) {
    const productId = catalogSelections[request.id];
    const item = request.availableItems.find(
      (candidate) => candidate.productId === productId,
    );
    if (!item) return;
    setReviewItems((current) => ({
      ...current,
      [request.id]: [...(current[request.id] ?? []), editableCatalogItem(item)],
    }));
    setCatalogSelections((current) => ({ ...current, [request.id]: "" }));
  }

  function chooseNewSupplier(supplierId: string) {
    setNewSupplierId(supplierId);
    setNewItems([]);
    setNewItemSelection("");
  }

  function addNewOrderItem(catalog: OrderCatalog) {
    const item = catalog.items.find(
      (candidate) => candidate.productId === newItemSelection,
    );
    if (!item) return;
    setNewItems((current) => [...current, editableCatalogItem(item)]);
    setNewItemSelection("");
  }

  function updateNewOrderItem(
    productId: string,
    update: Partial<EditableReviewItem>,
  ) {
    setNewItems((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, ...update } : item,
      ),
    );
  }

  async function requestApproval(basket: SupplierBasket) {
    setBusyKey(`request:${basket.supplierId}`);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/orders/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: basket.supplierId,
        note: notes[basket.supplierId] ?? "",
        items: basket.items.map((item) => ({
          productId: item.productId,
          packageCount: countFor(basket, item.productId),
        })),
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setBusyKey(null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to request approval");
      return;
    }
    setMessage(`${basket.supplierName} basket sent to a manager.`);
    router.refresh();
  }

  async function createOrder() {
    if (!newOrderCatalog || !newItems.length) return;
    setBusyKey("create-order");
    setError(null);
    setMessage(null);
    const response = await fetch("/api/orders/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: newOrderCatalog.supplierId,
        note: newOrderNote,
        items: newItems.map((item) => ({
          productId: item.productId,
          packageCount: item.packageCount,
          requestedQuantity: item.requestedQuantity,
        })),
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setBusyKey(null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to create order");
      return;
    }
    setIsCreatingOrder(false);
    setNewItems([]);
    setNewItemSelection("");
    setNewOrderNote("");
    setMessage(`${newOrderCatalog.supplierName} order created.`);
    router.refresh();
  }

  async function mutateRequest(
    request: OrderApprovalRequest,
    action: "save" | "approve",
  ) {
    setBusyKey(`${action}:${request.id}`);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/orders/requests/${request.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        note: reviewNotes[request.id] ?? "",
        items: (reviewItems[request.id] ?? []).map((item) => ({
          productId: item.productId,
          packageCount: item.packageCount,
          requestedQuantity: item.requestedQuantity,
        })),
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setBusyKey(null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update order");
      return;
    }
    setMessage(
      action === "approve"
        ? `${request.supplierName} order approved and ready to copy.`
        : `${request.supplierName} order saved.`,
    );
    router.refresh();
  }

  async function deleteRequest(request: OrderApprovalRequest) {
    if (!window.confirm(`Delete the ${request.supplierName} order?`)) return;
    setBusyKey(`delete:${request.id}`);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/orders/requests/${request.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setBusyKey(null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete order");
      return;
    }
    setMessage(`${request.supplierName} order deleted.`);
    router.refresh();
  }

  async function copyRequest(request: OrderApprovalRequest) {
    const text = approvedList(request);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopiedId(request.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError(
        "Could not copy the list. Select the text and copy it manually.",
      );
    }
  }

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
              Adjust package quantities, request approval, and turn approved
              baskets into supplier-ready lists.
            </p>
          </div>
          <div className="orders-header-actions">
            <Button
              disabled={!orders.catalogs.length}
              onClick={() => setIsCreatingOrder((current) => !current)}
              size="sm"
              type="button"
            >
              <Plus /> New order
            </Button>
            <Button
              asChild
              className="receipt-action-button"
              size="sm"
              variant="outline"
            >
              <Link href="/receipts/import">Import latest receipt</Link>
            </Button>
          </div>
        </header>

        {message ? <p className="orders-feedback success">{message}</p> : null}
        {error ? (
          <p className="orders-feedback error" role="alert">
            {error}
          </p>
        ) : null}

        {isCreatingOrder ? (
          <section className="approval-workspace create-order-workspace">
            <div className="orders-section-heading">
              <div>
                <p className="eyebrow">CREATE</p>
                <h2>New supplier order</h2>
              </div>
              <Button
                onClick={() => setIsCreatingOrder(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
            <div className="approval-card">
              <div className="approval-add-item create-order-supplier">
                <label>
                  <span>Supplier</span>
                  <select
                    onChange={(event) => chooseNewSupplier(event.target.value)}
                    value={newSupplierId}
                  >
                    {orders.catalogs.map((catalog) => (
                      <option
                        key={catalog.supplierId}
                        value={catalog.supplierId}
                      >
                        {catalog.supplierName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Add supplier item</span>
                  <select
                    onChange={(event) =>
                      setNewItemSelection(event.target.value)
                    }
                    value={newItemSelection}
                  >
                    <option value="">Choose an item…</option>
                    {newOrderCatalog?.items
                      .filter(
                        (item) =>
                          !newItems.some(
                            (current) => current.productId === item.productId,
                          ),
                      )
                      .map((item) => (
                        <option key={item.productId} value={item.productId}>
                          {item.productName}
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  disabled={!newItemSelection || !newOrderCatalog}
                  onClick={() =>
                    newOrderCatalog && addNewOrderItem(newOrderCatalog)
                  }
                  type="button"
                  variant="outline"
                >
                  <Plus /> Add item
                </Button>
              </div>
              <div className="approval-lines">
                {newItems.length ? (
                  newItems.map((item) => (
                    <div className="approval-line" key={item.productId}>
                      <div>
                        <strong>{item.productName}</strong>
                        <small>
                          {item.supplierSku
                            ? `SKU ${item.supplierSku}`
                            : "No supplier SKU"}
                        </small>
                      </div>
                      <label>
                        <span>Packages</span>
                        <input
                          min="1"
                          onChange={(event) => {
                            const packageCount = Math.max(
                              1,
                              Math.round(Number(event.target.value) || 1),
                            );
                            updateNewOrderItem(item.productId, {
                              packageCount,
                              requestedQuantity:
                                packageCount * item.unitsPerPackage,
                            });
                          }}
                          step="1"
                          type="number"
                          value={item.packageCount}
                        />
                      </label>
                      <label>
                        <span>Amount ({item.unit})</span>
                        <input
                          min="0.001"
                          onChange={(event) =>
                            updateNewOrderItem(item.productId, {
                              requestedQuantity: Math.max(
                                0.001,
                                Number(event.target.value) || 0.001,
                              ),
                            })
                          }
                          step="0.001"
                          type="number"
                          value={item.requestedQuantity}
                        />
                      </label>
                      <div className="approval-line-total">
                        <strong>
                          {quantity(item.requestedQuantity)} {item.unit}
                        </strong>
                        <small>
                          {item.latestPackagePrice === null
                            ? "Price unavailable"
                            : displayMoney(
                                item.latestPackagePrice * item.packageCount,
                                newOrderCatalog?.currency,
                              )}
                        </small>
                      </div>
                      <Button
                        aria-label={`Remove ${item.productName}`}
                        onClick={() =>
                          setNewItems((current) =>
                            current.filter(
                              (line) => line.productId !== item.productId,
                            ),
                          )
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="approval-empty-lines">
                    Add at least one item to create this order.
                  </p>
                )}
              </div>
              <footer className="create-order-footer">
                <label>
                  <span>Order note</span>
                  <textarea
                    maxLength={500}
                    onChange={(event) => setNewOrderNote(event.target.value)}
                    placeholder="Optional note"
                    value={newOrderNote}
                  />
                </label>
                <Button
                  disabled={!newItems.length || busyKey === "create-order"}
                  onClick={createOrder}
                  type="button"
                >
                  {busyKey === "create-order" ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <Plus />
                  )}{" "}
                  Create order
                </Button>
              </footer>
            </div>
          </section>
        ) : null}

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
              <strong>{displayNumber(pendingRequests.length)}</strong>
              <small>waiting for approval</small>
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

        {pendingRequests.length ? (
          <section
            className="approval-workspace"
            aria-labelledby="approval-heading"
          >
            <div className="orders-section-heading">
              <div>
                <p className="eyebrow">
                  {canReview ? "MANAGER REVIEW" : "YOUR ORDERS"}
                </p>
                <h2 id="approval-heading">
                  {canReview
                    ? "Baskets waiting for you"
                    : "Waiting for approval"}
                </h2>
              </div>
              <Badge variant="outline">{pendingRequests.length} pending</Badge>
            </div>
            {pendingRequests.map((request) => {
              const items = reviewItems[request.id] ?? [];
              const availableItems = request.availableItems.filter(
                (item) =>
                  !items.some(
                    (currentItem) => currentItem.productId === item.productId,
                  ),
              );
              return (
                <article className="approval-card" key={request.id}>
                  <header>
                    <div className="approval-person">
                      <span>
                        <UserCheck />
                      </span>
                      <div>
                        <h3>{request.supplierName}</h3>
                        <p>
                          Requested by {request.requesterName} ·{" "}
                          {requestDate(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge>{canReview ? "Needs approval" : "Pending"}</Badge>
                  </header>
                  <label className="approval-edit-note">
                    <span>Order note</span>
                    <textarea
                      maxLength={500}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Optional note"
                      value={reviewNotes[request.id] ?? ""}
                    />
                  </label>
                  <div className="approval-add-item">
                    <label>
                      <span>Add another supplier item</span>
                      <select
                        onChange={(event) =>
                          setCatalogSelections((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        value={catalogSelections[request.id] ?? ""}
                      >
                        <option value="">Choose an item…</option>
                        {availableItems.map((item) => (
                          <option key={item.productId} value={item.productId}>
                            {item.productName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      disabled={!catalogSelections[request.id]}
                      onClick={() => addReviewItem(request)}
                      type="button"
                      variant="outline"
                    >
                      <Plus /> Add item
                    </Button>
                  </div>
                  <div className="approval-lines">
                    {items.length ? (
                      items.map((line) => (
                        <div className="approval-line" key={line.productId}>
                          <div>
                            <strong>{line.productName}</strong>
                            <small>
                              {line.supplierSku
                                ? `SKU ${line.supplierSku}`
                                : "No supplier SKU"}{" "}
                              · {quantity(line.unitsPerPackage)} {line.unit} per
                              package
                            </small>
                          </div>
                          <label>
                            <span>Packages</span>
                            <input
                              min="1"
                              onChange={(event) => {
                                const packageCount = Math.max(
                                  1,
                                  Math.round(Number(event.target.value) || 1),
                                );
                                updateReviewItem(request.id, line.productId, {
                                  packageCount,
                                  requestedQuantity:
                                    packageCount * line.unitsPerPackage,
                                });
                              }}
                              step="1"
                              type="number"
                              value={line.packageCount}
                            />
                          </label>
                          <label>
                            <span>Amount ({line.unit})</span>
                            <input
                              min="0.001"
                              onChange={(event) =>
                                updateReviewItem(request.id, line.productId, {
                                  requestedQuantity: Math.max(
                                    0.001,
                                    Number(event.target.value) || 0.001,
                                  ),
                                })
                              }
                              step="0.001"
                              type="number"
                              value={line.requestedQuantity}
                            />
                          </label>
                          <div className="approval-line-total">
                            <strong>
                              {quantity(line.requestedQuantity)} {line.unit}
                            </strong>
                            <small>
                              {line.latestPackagePrice === null
                                ? "Price unavailable"
                                : displayMoney(
                                    line.packageCount * line.latestPackagePrice,
                                    request.currency,
                                  )}
                            </small>
                          </div>
                          <Button
                            aria-label={`Remove ${line.productName}`}
                            onClick={() =>
                              removeReviewItem(request.id, line.productId)
                            }
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="approval-empty-lines">
                        This basket is empty. Add at least one supplier item.
                      </p>
                    )}
                  </div>
                  <footer className="order-crud-footer">
                    <small>
                      Add, remove, or update packages and amounts before
                      approval.
                    </small>
                    <div className="order-crud-actions">
                      <Button
                        disabled={busyKey === `delete:${request.id}`}
                        onClick={() => deleteRequest(request)}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 /> Delete
                      </Button>
                      <Button
                        disabled={
                          !items.length || busyKey === `save:${request.id}`
                        }
                        onClick={() => mutateRequest(request, "save")}
                        type="button"
                        variant="outline"
                      >
                        {busyKey === `save:${request.id}` ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <Save />
                        )}{" "}
                        Save changes
                      </Button>
                      {canReview ? (
                        <Button
                          disabled={
                            !items.length || busyKey === `approve:${request.id}`
                          }
                          onClick={() => mutateRequest(request, "approve")}
                          type="button"
                        >
                          {busyKey === `approve:${request.id}` ? (
                            <LoaderCircle className="spin" />
                          ) : (
                            <CheckCircle2 />
                          )}{" "}
                          Approve order
                        </Button>
                      ) : null}
                    </div>
                  </footer>
                </article>
              );
            })}
          </section>
        ) : null}

        {approvedRequests.length ? (
          <section
            className="approved-orders"
            aria-labelledby="approved-heading"
          >
            <div className="orders-section-heading">
              <div>
                <p className="eyebrow">READY TO ORDER</p>
                <h2 id="approved-heading">Approved supplier lists</h2>
              </div>
            </div>
            <div className="approved-order-grid">
              {approvedRequests.map((request) => (
                <article className="approved-order-card" key={request.id}>
                  <header>
                    <div>
                      <CheckCircle2 />
                      <span>
                        <strong>{request.supplierName}</strong>
                        <small>
                          Approved{" "}
                          {request.reviewedAt
                            ? requestDate(request.reviewedAt)
                            : "recently"}
                        </small>
                      </span>
                    </div>
                    <div className="approved-order-actions">
                      {canReview ? (
                        <Button
                          aria-label={`Delete ${request.supplierName} order`}
                          disabled={busyKey === `delete:${request.id}`}
                          onClick={() => deleteRequest(request)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                      <Button
                        onClick={() => copyRequest(request)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Clipboard />{" "}
                        {copiedId === request.id ? "Copied" : "Copy list"}
                      </Button>
                    </div>
                  </header>
                  <pre>{approvedList(request)}</pre>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {orders.baskets.length ? (
          <section className="orders-baskets">
            <div className="orders-section-heading">
              <div>
                <p className="eyebrow">LIVE RECOMMENDATIONS</p>
                <h2>Supplier baskets</h2>
              </div>
            </div>
            {orders.baskets.map((basket) => {
              const hasPending = pendingRequests.some(
                (request) => request.supplierId === basket.supplierId,
              );
              const basketValue = basket.items.reduce(
                (total, item) =>
                  total +
                  (item.latestPackagePrice ?? 0) *
                    countFor(basket, item.productId),
                0,
              );
              return (
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
                        {displayMoney(basketValue, basket.currency)}
                      </strong>
                    </div>
                  </header>
                  <div className="order-basket-table-wrap">
                    <table className="order-basket-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>On hand</th>
                          <th>Minimum</th>
                          <th>Order</th>
                          <th>Packages</th>
                          <th>Estimated cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {basket.items.map((item) => {
                          const packages = countFor(basket, item.productId);
                          return (
                            <tr key={item.productId}>
                              <td data-label="Item">
                                <strong>
                                  {displayText(item.productName, "Item")}
                                </strong>
                                <small>
                                  {item.supplierSku
                                    ? `SKU ${item.supplierSku}`
                                    : "No supplier SKU"}
                                </small>
                              </td>
                              <td data-label="On hand">
                                {quantity(item.currentQuantity)} {item.unit}
                              </td>
                              <td data-label="Minimum">
                                {quantity(item.minimumQuantity)} {item.unit}
                              </td>
                              <td data-label="Order">
                                {quantity(packages * item.unitsPerPackage)}{" "}
                                {item.unit}
                                <small>
                                  shortage {quantity(item.shortageQuantity)}{" "}
                                  {item.unit}
                                </small>
                              </td>
                              <td data-label="Packages">
                                <label className="package-count-input">
                                  <span className="sr-only">
                                    Packages for {item.productName}
                                  </span>
                                  <input
                                    min="0"
                                    onChange={(event) =>
                                      setBasketCounts((current) => ({
                                        ...current,
                                        [`${basket.supplierId}:${item.productId}`]:
                                          Math.max(
                                            0,
                                            Number(event.target.value) || 0,
                                          ),
                                      }))
                                    }
                                    step="1"
                                    type="number"
                                    value={packages}
                                  />
                                  <small>
                                    × {quantity(item.unitsPerPackage)}{" "}
                                    {item.unit}
                                  </small>
                                </label>
                              </td>
                              <td data-label="Estimated cost">
                                {item.latestPackagePrice === null
                                  ? "—"
                                  : displayMoney(
                                      item.latestPackagePrice * packages,
                                      basket.currency,
                                    )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {isEmployee ? (
                    <footer className="basket-request-footer">
                      <label>
                        <span>
                          Note for manager <small>Optional</small>
                        </span>
                        <textarea
                          maxLength={500}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [basket.supplierId]: event.target.value,
                            }))
                          }
                          placeholder="Anything the manager should know?"
                          value={notes[basket.supplierId] ?? ""}
                        />
                      </label>
                      <Button
                        disabled={
                          hasPending ||
                          busyKey === `request:${basket.supplierId}`
                        }
                        onClick={() => requestApproval(basket)}
                        type="button"
                      >
                        {busyKey === `request:${basket.supplierId}` ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <Send />
                        )}{" "}
                        {hasPending
                          ? "Waiting for manager"
                          : "Ask manager for approval"}
                      </Button>
                    </footer>
                  ) : null}
                </article>
              );
            })}
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
