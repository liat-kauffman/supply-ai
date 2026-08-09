"use client";

import {
  AlertTriangle,
  ArchiveX,
  Box,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  ClipboardCheck,
  Filter,
  ImagePlus,
  LoaderCircle,
  PackagePlus,
  PencilLine,
  Power,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { navigation } from "@/components/dashboard/dashboard-data";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  displayNumber,
  displayPercent,
  displayText,
  finiteNumberOrNull,
} from "@/lib/display";
import { type InventoryItem, type InventoryStatus } from "./inventory-data";
import { AreaPhotoScanner } from "./area-photo-scanner";

const filters: Array<{ label: string; value: "all" | InventoryStatus }> = [
  { label: "All items", value: "all" },
  { label: "Low stock", value: "low" },
  { label: "Out of stock", value: "out" },
  { label: "Needs review", value: "review" },
  { label: "Healthy", value: "healthy" },
];

const statusLabels: Record<InventoryStatus, string> = {
  healthy: "Healthy",
  low: "Low stock",
  out: "Out of stock",
  review: "Review count",
};

const ITEMS_PER_PAGE = 10;

type PendingAreaScan = {
  id: string;
  createdAt: string;
  createdByName: string;
  storageAreaName: string | null;
  observations: Array<{
    productId: string;
    name: string;
    count: number;
    confidence: number;
  }>;
  globalWarnings: string[];
};

export function InventoryShell({
  companyName,
  currentRole,
  initialItems,
  pendingScans,
  storageAreas,
  userName,
}: {
  companyName: string;
  currentRole: string;
  initialItems: InventoryItem[];
  pendingScans: PendingAreaScan[];
  storageAreas: Array<{ id: string; name: string; location: { name: string } }>;
  userName: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [openScans, setOpenScans] = useState(pendingScans);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InventoryStatus>(
    "all",
  );
  const [showInactive, setShowInactive] = useState(false);
  const [category, setCategory] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isScanningArea, setIsScanningArea] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCountSaving, setIsCountSaving] = useState(false);
  const [isItemSaving, setIsItemSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [manualQuantity, setManualQuantity] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countProposal, setCountProposal] = useState<{
    count: number;
    confidence: number;
    explanation: string;
    warnings: string[];
  } | null>(null);
  const canApproveCounts = currentRole === "owner" || currentRole === "manager";

  async function approveHighConfidenceScan(scanId: string) {
    setIsCountSaving(true);
    try {
      const response = await fetch("/api/inventory/area-photo/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        items?: InventoryItem[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.items)
        throw new Error(payload?.error ?? "Unable to approve this scan");
      setItems((current) =>
        current.map(
          (item) => payload.items?.find((next) => next.id === item.id) ?? item,
        ),
      );
      setOpenScans((current) => current.filter((scan) => scan.id !== scanId));
      setMessage("High-confidence counts were approved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to approve this scan",
      );
    } finally {
      setIsCountSaving(false);
    }
  }

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const userInitials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort(),
    [items],
  );

  const suppliers = useMemo(
    () => [...new Set(items.map((item) => item.supplier))].sort(),
    [items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!showInactive && !item.active) return false;
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.supplier.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesCategory = category === "all" || item.category === category;
      const matchesSupplier = supplier === "all" || item.supplier === supplier;
      return (
        matchesQuery && matchesStatus && matchesCategory && matchesSupplier
      );
    });
  }, [category, items, query, showInactive, statusFilter, supplier]);

  const activeItems = items.filter((item) => item.active);
  const inactiveCount = items.length - activeItems.length;
  const totalPages = Math.max(
    1,
    Math.ceil(visibleItems.length / ITEMS_PER_PAGE),
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = visibleItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  const pageStart = visibleItems.length
    ? (currentPage - 1) * ITEMS_PER_PAGE + 1
    : 0;
  const pageEnd = visibleItems.length
    ? Math.min(currentPage * ITEMS_PER_PAGE, visibleItems.length)
    : 0;
  const lowCount = activeItems.filter((item) => item.status === "low").length;
  const outCount = activeItems.filter((item) => item.status === "out").length;
  const reviewCount = activeItems.filter(
    (item) => item.status === "review",
  ).length;
  const healthyPercent = activeItems.length
    ? Math.round(
        (activeItems.filter((item) => item.status === "healthy").length /
          activeItems.length) *
          100,
      )
    : 0;

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const itemCategory = String(form.get("category")).trim();
    const itemSupplier = String(form.get("supplier")).trim();
    const quantity = Number(form.get("quantity"));
    const minimum = Number(form.get("minimum"));
    const unit = String(form.get("unit")).trim();
    try {
      const response = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: String(form.get("description")).trim(),
          category: itemCategory,
          supplier: itemSupplier,
          quantity,
          unit,
          minimum,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        item?: InventoryItem;
        error?: string;
      } | null;
      if (!response.ok || !payload?.item)
        throw new Error(payload?.error ?? "Unable to add this item");
      setItems((current) => [payload.item as InventoryItem, ...current]);
      setPage(1);
      setIsAdding(false);
      setMessage(`${name} was added to inventory.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to add this item",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openItem(item: InventoryItem) {
    setSelectedItemId(item.id);
    setManualQuantity(String(item.quantity));
    setMinimumQuantity(String(item.minimum));
    setPhotoError(null);
    setDetailError(null);
    setCountProposal(null);
  }

  function closeItem() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setSelectedItemId(null);
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError(null);
    setDetailError(null);
    setCountProposal(null);
    setIsAnalyzing(false);
  }

  function replaceItem(nextItem: InventoryItem) {
    setItems((current) =>
      current.map((item) => (item.id === nextItem.id ? nextItem : item)),
    );
    setManualQuantity(String(nextItem.quantity));
    setMinimumQuantity(String(nextItem.minimum));
  }

  function choosePhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    setPhotoError(null);
    setCountProposal(null);
  }

  async function updateQuantity(quantity: number, source: "manual" | "photo") {
    if (!selectedItem || !Number.isFinite(quantity) || quantity < 0) return;
    setIsCountSaving(true);
    try {
      const response = await fetch(
        `/api/inventory/items/${selectedItem.id}/quantity`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quantity, source }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        item?: InventoryItem;
        error?: string;
      } | null;
      if (!response.ok || !payload?.item)
        throw new Error(payload?.error ?? "Unable to update this count");
      replaceItem(payload.item as InventoryItem);
      setMessage(
        `${selectedItem.name} was updated to ${quantity} ${selectedItem.unit}.`,
      );
      closeItem();
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "Unable to update this count",
      );
    } finally {
      setIsCountSaving(false);
    }
  }

  async function updateItemDetails(next: {
    minimum?: number;
    active?: boolean;
  }) {
    if (!selectedItem) return;
    setIsItemSaving(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/inventory/items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const payload = (await response.json().catch(() => null)) as {
        item?: InventoryItem;
        error?: string;
      } | null;
      if (!response.ok || !payload?.item)
        throw new Error(payload?.error ?? "Unable to update this item");
      replaceItem(payload.item as InventoryItem);
      setMessage(
        next.active === false
          ? `${selectedItem.name} was disabled.`
          : next.active === true
            ? `${selectedItem.name} was re-enabled.`
            : `${selectedItem.name} minimum is now ${payload.item.minimum} ${payload.item.unit}.`,
      );
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to update this item",
      );
    } finally {
      setIsItemSaving(false);
    }
  }

  async function deleteItem() {
    if (!selectedItem) return;
    setIsItemSaving(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/inventory/items/${selectedItem.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        archived?: boolean;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to delete this item");
      }
      setItems((current) =>
        current.filter((item) => item.id !== selectedItem.id),
      );
      setMessage(
        payload?.archived
          ? `${selectedItem.name} was removed from active inventory and its receipt history was kept.`
          : `${selectedItem.name} was deleted from inventory.`,
      );
      closeItem();
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to delete this item",
      );
    } finally {
      setIsItemSaving(false);
    }
  }

  async function analyzePhoto() {
    if (!selectedItem || !photo) return;
    setIsAnalyzing(true);
    setPhotoError(null);
    setCountProposal(null);
    const form = new FormData();
    form.set("image", photo);
    form.set("itemName", selectedItem.name);
    form.set("unit", selectedItem.unit);
    try {
      const response = await fetch("/api/inventory/count-photo", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        canCount?: boolean;
        count?: number;
        confidence?: number;
        explanation?: string;
        warnings?: string[];
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Unable to analyze this photo");
      if (!payload?.canCount || typeof payload.count !== "number") {
        setPhotoError(
          payload?.explanation ??
            "The photo is not clear enough for a reliable count. Update the amount manually instead.",
        );
        return;
      }
      setCountProposal({
        count: payload.count,
        confidence: payload.confidence ?? 0,
        explanation: payload.explanation ?? "Counted visible matching items.",
        warnings: payload.warnings ?? [],
      });
      setManualQuantity(String(payload.count));
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "Unable to analyze this photo",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="app-shell inventory-shell">
      <Sidebar
        items={navigation}
        user={{
          initials: userInitials,
          name: userName,
          subtitle: companyName,
        }}
      />
      <main className="inventory-main">
        <header className="inventory-header">
          <div>
            <p className="eyebrow">STOCK CONTROL</p>
            <h1>Inventory</h1>
          </div>
          <div className="inventory-header-actions">
            <Button onClick={() => setIsScanningArea(true)} variant="outline">
              <Camera />
              <span className="action-copy">Scan area with AI</span>
            </Button>
            <Button asChild variant="outline">
              <Link href="/receipts/import">
                <ReceiptText />
                <span className="action-copy">Import supplier receipts</span>
              </Link>
            </Button>
            <Button className="primary" onClick={() => setIsAdding(true)}>
              <PackagePlus />
              <span className="action-copy">Add inventory item</span>
            </Button>
          </div>
        </header>

        {message ? (
          <div className="store-message inventory-message" role="status">
            <CheckCircle2 />
            <span>{message}</span>
            <Button
              aria-label="Dismiss message"
              onClick={() => setMessage(null)}
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        ) : null}

        {canApproveCounts && openScans.length ? (
          <section
            className="pending-area-scans"
            aria-labelledby="pending-area-scans-title"
          >
            <div className="orders-section-heading">
              <div>
                <p className="eyebrow">MANAGER REVIEW</p>
                <h2 id="pending-area-scans-title">
                  Counts waiting for approval
                </h2>
                <p>
                  Approve high-confidence counts together. Review warnings
                  separately.
                </p>
              </div>
            </div>
            <div className="pending-area-scan-list">
              {openScans.map((scan) => {
                const highConfidence = scan.observations.filter(
                  (observation) => observation.confidence >= 0.85,
                );
                return (
                  <article className="pending-area-scan" key={scan.id}>
                    <div>
                      <strong>
                        {scan.storageAreaName ?? "All inventory areas"}
                      </strong>
                      <span>
                        Submitted by {scan.createdByName} ·{" "}
                        {highConfidence.length} high-confidence count
                        {highConfidence.length === 1 ? "" : "s"}
                      </span>
                      {scan.globalWarnings.length ? (
                        <small>{scan.globalWarnings.join(" · ")}</small>
                      ) : null}
                    </div>
                    <Button
                      disabled={isCountSaving || !highConfidence.length}
                      onClick={() => approveHighConfidenceScan(scan.id)}
                      size="sm"
                      type="button"
                    >
                      Approve high-confidence
                    </Button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="inventory-summary" aria-label="Inventory summary">
          <article>
            <span className="summary-icon neutral">
              <Box />
            </span>
            <div>
              <small>Total items</small>
              <strong>{activeItems.length}</strong>
              <span>
                Across {categories.length} categories
                {inactiveCount ? ` · ${inactiveCount} disabled` : ""}
              </span>
            </div>
          </article>
          <article>
            <span className="summary-icon warning">
              <AlertTriangle />
            </span>
            <div>
              <small>Low stock</small>
              <strong>{lowCount}</strong>
              <span>Below minimum level</span>
            </div>
          </article>
          <article>
            <span className="summary-icon danger">
              <CircleOff />
            </span>
            <div>
              <small>Out of stock</small>
              <strong>{outCount}</strong>
              <span>Needs immediate action</span>
            </div>
          </article>
          <article>
            <span className="summary-icon review">
              <ClipboardCheck />
            </span>
            <div>
              <small>Stock health</small>
              <strong>{healthyPercent}%</strong>
              <span>{reviewCount} count to review</span>
            </div>
          </article>
        </section>

        <section className="inventory-workspace">
          <div className="inventory-toolbar">
            <div className="inventory-search">
              <Search />
              <input
                aria-label="Search inventory"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search items, categories or suppliers"
                type="search"
                value={query}
              />
            </div>
            <div className="inventory-select-filters">
              <Button
                className={`inventory-toggle-button${showInactive ? " inventory-toggle-active" : ""}`}
                onClick={() => setShowInactive((current) => !current)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Power />
                {showInactive ? "Hide disabled" : "Show disabled"}
              </Button>
              <label className="inventory-select-filter">
                <SlidersHorizontal />
                <select
                  aria-label="Filter by category"
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setPage(1);
                  }}
                  value={category}
                >
                  <option value="all">All categories</option>
                  {categories.map((itemCategory) => (
                    <option key={itemCategory} value={itemCategory}>
                      {itemCategory}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inventory-select-filter">
                <Truck />
                <select
                  aria-label="Filter by supplier"
                  onChange={(event) => {
                    setSupplier(event.target.value);
                    setPage(1);
                  }}
                  value={supplier}
                >
                  <option value="all">All suppliers</option>
                  {suppliers.map((itemSupplier) => (
                    <option key={itemSupplier} value={itemSupplier}>
                      {itemSupplier}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="inventory-filter-row">
            <span>
              <Filter /> Filter
            </span>
            {filters.map((filter) => (
              <button
                className={statusFilter === filter.value ? "active" : undefined}
                key={filter.value}
                onClick={() => {
                  setStatusFilter(filter.value);
                  setPage(1);
                }}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="inventory-table-head" aria-hidden="true">
            <span>Item</span>
            <span>On hand</span>
            <span>Minimum</span>
            <span>Status</span>
            <span>Last update</span>
            <span />
          </div>
          <div className="inventory-list">
            {visibleItems.length ? (
              paginatedItems.map((item) => {
                const level =
                  item.minimum > 0
                    ? Math.min(
                        100,
                        Math.round((item.quantity / item.minimum) * 70),
                      )
                    : 100;
                return (
                  <article className="inventory-row" key={item.id}>
                    <div className="inventory-item-name">
                      <span>{item.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <div className="inventory-item-meta">
                          <span>{item.category}</span>
                          {!item.active ? <span>Disabled</span> : null}
                          <span>
                            <Truck /> {item.supplier}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inventory-quantity">
                      <strong>{displayNumber(item.quantity)}</strong>
                      <span>{item.unit}</span>
                      <Progress
                        indicatorClassName={item.status}
                        value={level}
                      />
                    </div>
                    <div className="inventory-minimum">
                      <strong>{displayNumber(item.minimum)}</strong>
                      <span>{item.unit}</span>
                    </div>
                    <div>
                      <Badge
                        className={`inventory-status ${item.active ? item.status : "review"}`}
                        variant="secondary"
                      >
                        {item.active ? statusLabels[item.status] : "Disabled"}
                      </Badge>
                    </div>
                    <span className="inventory-updated">{item.updated}</span>
                    <Button
                      aria-label={`Open ${item.name}`}
                      onClick={() => openItem(item)}
                      size="icon"
                      variant="ghost"
                    >
                      <ChevronRight />
                    </Button>
                  </article>
                );
              })
            ) : (
              <div className="inventory-empty">
                <Search />
                <h2>No items found</h2>
                <p>Try another search or clear the selected filters.</p>
                <Button
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                    setSupplier("all");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  variant="outline"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
          {visibleItems.length > ITEMS_PER_PAGE ? (
            <div className="inventory-pagination">
              <span>
                Showing {pageStart}-{pageEnd} of {visibleItems.length}
              </span>
              <div>
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <small>
                  Page {currentPage} of {totalPages}
                </small>
                <Button
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <p className="inventory-note">
          Preview data only. Inventory changes will remain approval-gated when
          persistence is connected.
        </p>
      </main>
      <MobileNavigation
        items={navigation.map(({ label, href, icon }) => ({
          label,
          href,
          icon,
        }))}
      />

      {isScanningArea ? (
        <AreaPhotoScanner
          canApprove={canApproveCounts}
          storageAreas={storageAreas}
          onApplied={(nextItems) => {
            setItems((current) =>
              current.map(
                (item) =>
                  nextItems.find((nextItem) => nextItem.id === item.id) ?? item,
              ),
            );
            setMessage("The approved area counts were saved to inventory.");
            setIsScanningArea(false);
          }}
          onClose={() => setIsScanningArea(false)}
        />
      ) : null}

      {selectedItem ? (
        <div className="inventory-modal-backdrop" onMouseDown={closeItem}>
          <section
            aria-labelledby="inventory-item-title"
            aria-modal="true"
            className="inventory-modal inventory-item-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="inventory-modal-heading item-detail-heading">
              <div className="item-detail-title">
                <span className="item-detail-avatar">
                  {selectedItem.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="eyebrow">{selectedItem.category}</p>
                  <h2 id="inventory-item-title">{selectedItem.name}</h2>
                  <p className="item-supplier">
                    <Truck /> Supplied by {selectedItem.supplier}
                  </p>
                  <Badge
                    className={`inventory-status ${selectedItem.active ? selectedItem.status : "review"}`}
                    variant="secondary"
                  >
                    {selectedItem.active
                      ? statusLabels[selectedItem.status]
                      : "Disabled"}
                  </Badge>
                </div>
              </div>
              <Button
                aria-label="Close item details"
                onClick={closeItem}
                size="icon"
                variant="ghost"
              >
                <X />
              </Button>
            </div>

            <div className="item-detail-body">
              <section className="item-description-card">
                <div>
                  <small>Current amount</small>
                  <strong>{displayNumber(selectedItem.quantity)}</strong>
                  <span>{displayText(selectedItem.unit, "units")}</span>
                </div>
                <div>
                  <small>Minimum level</small>
                  <strong>{displayNumber(selectedItem.minimum)}</strong>
                  <span>{displayText(selectedItem.unit, "units")}</span>
                </div>
                <p>{selectedItem.description}</p>
              </section>

              <section className="manual-count-card item-settings-card">
                <div className="item-section-heading">
                  <span className="item-section-icon manual">
                    <PencilLine />
                  </span>
                  <div>
                    <h3>Manager controls</h3>
                    <p>
                      Update the minimum level, disable products, or delete
                      items with no history.
                    </p>
                  </div>
                </div>
                <form
                  className="item-minimum-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const minimum = finiteNumberOrNull(minimumQuantity);
                    if (minimum === null) return;
                    updateItemDetails({ minimum });
                  }}
                >
                  <label>
                    Minimum amount
                    <div>
                      <input
                        min="0"
                        onChange={(event) =>
                          setMinimumQuantity(event.target.value)
                        }
                        required
                        step="0.5"
                        type="number"
                        value={minimumQuantity}
                      />
                      <span>{selectedItem.unit}</span>
                    </div>
                  </label>
                  <Button
                    disabled={
                      isItemSaving ||
                      !minimumQuantity ||
                      finiteNumberOrNull(minimumQuantity) === null ||
                      Number(minimumQuantity) < 0
                    }
                    type="submit"
                    variant="outline"
                  >
                    {isItemSaving ? "Saving…" : "Save minimum"}
                  </Button>
                </form>

                <div className="item-management-actions">
                  <Button
                    disabled={isItemSaving}
                    onClick={() => {
                      const nextActive = !selectedItem.active;
                      const confirmed = window.confirm(
                        nextActive
                          ? `Re-enable ${selectedItem.name}?`
                          : `Disable ${selectedItem.name}? It will be hidden from the active inventory list unless disabled items are shown.`,
                      );
                      if (!confirmed) return;
                      updateItemDetails({ active: nextActive });
                    }}
                    type="button"
                    variant="outline"
                  >
                    <Power />
                    {selectedItem.active
                      ? "Disable product"
                      : "Re-enable product"}
                  </Button>
                  <Button
                    className="inventory-danger-button"
                    disabled={isItemSaving}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Delete ${selectedItem.name}? This only works for products with no inventory or receipt history.`,
                      );
                      if (!confirmed) return;
                      deleteItem();
                    }}
                    type="button"
                    variant="outline"
                  >
                    <ArchiveX />
                    Delete product
                  </Button>
                </div>

                {detailError ? (
                  <p className="photo-count-error" role="alert">
                    {detailError}
                  </p>
                ) : null}
              </section>

              <section className="photo-count-card">
                <div className="item-section-heading">
                  <span className="item-section-icon">
                    <Camera />
                  </span>
                  <div>
                    <h3>Count from a photo</h3>
                    <p>
                      Upload a clear photo. AI proposes a count; you approve it.
                    </p>
                  </div>
                </div>

                <label
                  className={`photo-dropzone ${photoPreview ? "has-photo" : ""}`}
                >
                  <input
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    capture="environment"
                    onChange={(event) =>
                      choosePhoto(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`Preview for ${selectedItem.name}`}
                      src={photoPreview}
                    />
                  ) : (
                    <>
                      <ImagePlus />
                      <strong>Take or upload a photo</strong>
                      <span>JPG, PNG, WebP or HEIC · up to 10 MB</span>
                    </>
                  )}
                </label>

                {photo ? (
                  <div className="photo-file-row">
                    <div>
                      <Upload />
                      <span>{photo.name}</span>
                    </div>
                    <Button
                      disabled={isAnalyzing || !selectedItem.active}
                      onClick={analyzePhoto}
                      size="sm"
                      type="button"
                    >
                      {isAnalyzing ? (
                        <LoaderCircle className="spin" />
                      ) : (
                        <Sparkles />
                      )}
                      {isAnalyzing ? "Counting…" : "Count items"}
                    </Button>
                  </div>
                ) : null}

                {photoError ? (
                  <p className="photo-count-error" role="alert">
                    {photoError}
                  </p>
                ) : null}

                {countProposal ? (
                  <div className="count-proposal">
                    <span>
                      <Sparkles /> AI count proposal
                    </span>
                    <div>
                      <strong>{displayNumber(countProposal.count)}</strong>
                      <em>{selectedItem.unit}</em>
                      <Badge variant="outline">
                        {displayPercent(countProposal.confidence * 100)}{" "}
                        confidence
                      </Badge>
                    </div>
                    <p>{countProposal.explanation}</p>
                    {countProposal.warnings.length ? (
                      <small>{countProposal.warnings.join(" · ")}</small>
                    ) : null}
                    {canApproveCounts ? (
                      <Button
                        disabled={isCountSaving || !selectedItem.active}
                        onClick={() =>
                          updateQuantity(countProposal.count, "photo")
                        }
                        type="button"
                      >
                        {isCountSaving
                          ? "Saving…"
                          : "Approve and update inventory"}
                      </Button>
                    ) : (
                      <small className="photo-count-manager-note">
                        A manager must approve this count before inventory is
                        updated.
                      </small>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="manual-count-card">
                <div className="item-section-heading">
                  <span className="item-section-icon manual">
                    <ClipboardCheck />
                  </span>
                  <div>
                    <h3>Update manually</h3>
                    <p>Enter the verified amount currently on hand.</p>
                  </div>
                </div>
                {!selectedItem.active ? (
                  <p className="photo-count-error" role="status">
                    Re-enable this product before updating its quantity.
                  </p>
                ) : null}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const quantity = finiteNumberOrNull(manualQuantity);
                    if (quantity === null) return;
                    updateQuantity(quantity, "manual");
                  }}
                >
                  <label>
                    Amount on hand
                    <div>
                      <input
                        min="0"
                        onChange={(event) =>
                          setManualQuantity(event.target.value)
                        }
                        required
                        step="0.5"
                        type="number"
                        value={manualQuantity}
                      />
                      <span>{selectedItem.unit}</span>
                    </div>
                  </label>
                  <Button
                    disabled={
                      isCountSaving ||
                      !selectedItem.active ||
                      !manualQuantity ||
                      finiteNumberOrNull(manualQuantity) === null ||
                      Number(manualQuantity) < 0
                    }
                    type="submit"
                  >
                    {isCountSaving ? "Saving…" : "Update amount"}
                  </Button>
                </form>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {isAdding ? (
        <div
          className="inventory-modal-backdrop"
          onMouseDown={() => setIsAdding(false)}
        >
          <section
            aria-labelledby="add-item-title"
            aria-modal="true"
            className="inventory-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="inventory-modal-heading">
              <div>
                <p className="eyebrow">NEW INVENTORY ITEM</p>
                <h2 id="add-item-title">Add an item</h2>
                <span>Start with the current count and minimum level.</span>
              </div>
              <Button
                aria-label="Close"
                onClick={() => setIsAdding(false)}
                size="icon"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
            <form className="inventory-form" onSubmit={addItem}>
              <label>
                Item name
                <input name="name" placeholder="e.g. Almond milk" required />
              </label>
              <div>
                <label>
                  Category
                  <input
                    name="category"
                    placeholder="e.g. Dairy alternatives"
                    required
                  />
                </label>
                <label>
                  Supplier
                  <input
                    name="supplier"
                    placeholder="e.g. Dairy Direct"
                    required
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  name="description"
                  placeholder="What this item is used for"
                  rows={3}
                />
              </label>
              <div>
                <label>
                  Current quantity
                  <input
                    min="0"
                    name="quantity"
                    step="0.5"
                    type="number"
                    required
                  />
                </label>
                <label>
                  Unit
                  <input name="unit" placeholder="cartons" required />
                </label>
              </div>
              <label>
                Minimum stock
                <input
                  min="0"
                  name="minimum"
                  step="0.5"
                  type="number"
                  required
                />
              </label>
              <div className="inventory-form-actions">
                <Button
                  onClick={() => setIsAdding(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={isSaving} type="submit">
                  {isSaving ? "Saving…" : "Add item"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
