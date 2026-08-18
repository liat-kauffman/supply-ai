"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileText,
  ImagePlus,
  LoaderCircle,
  PackageCheck,
  Plus,
  ReceiptText,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { displayPercent, displayText } from "@/lib/display";
import { isApiUploadTooLarge, MAX_API_UPLOAD_LABEL } from "@/lib/uploads";

interface SetupItem {
  id: string;
  receiptId: string;
  name: string;
  description: string;
  category: string;
  supplier: string;
  supplierSku: string;
  packageCount: string;
  unitsPerPackage: string;
  quantity: string;
  unit: string;
  minimum: string;
  packagePrice: string;
}

interface ProcessedReceipt {
  id: string;
  fileName: string;
  supplierName: string;
  receiptDate: string;
  invoiceNumber: string;
  confidence: number;
  vatAmount: string;
  totalAmount: string;
  warnings: string[];
}

interface ReceiptDraft {
  supplierName: string;
  receiptDate: string;
  invoiceNumber: string;
  confidence: number;
  vatAmount: number;
  totalAmount: number;
  items: Array<{
    name: string;
    description: string;
    category: string;
    supplierSku: string;
    packageCount: number;
    unitsPerPackage: number;
    quantity: number;
    unit: string;
    packagePrice: number;
  }>;
  warnings: string[];
  error?: string;
}

const newItem = (supplier = "", receiptId = ""): SetupItem => ({
  id: crypto.randomUUID(),
  receiptId,
  name: "",
  description: "",
  category: "",
  supplier,
  supplierSku: "",
  packageCount: "0",
  unitsPerPackage: "1",
  quantity: "0",
  unit: "units",
  minimum: "0",
  packagePrice: "0",
});

const steps = [
  { label: "Business", icon: Building2 },
  { label: "Receipt", icon: ReceiptText },
  { label: "Review", icon: PackageCheck },
];

const receiptImportSteps = [
  { label: "Scan", icon: ReceiptText },
  { label: "Review", icon: PackageCheck },
  { label: "Save", icon: Check },
];

export function BaseDataOnboarding({
  companyName,
  existingSetup = false,
}: {
  companyName: string;
  existingSetup?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(existingSetup ? 1 : 0);
  const [location, setLocation] = useState({
    name: "Main location",
    address: "",
  });
  const [timezone, setTimezone] = useState("Asia/Jerusalem");
  const [currency, setCurrency] = useState("ILS");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [processedReceipts, setProcessedReceipts] = useState<
    ProcessedReceipt[]
  >([]);
  const [items, setItems] = useState<SetupItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pending, setPending] = useState(false);
  const flowSteps = existingSetup ? receiptImportSteps : steps;

  function chooseReceipt(file: File | null) {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    if (file && isApiUploadTooLarge(file)) {
      setReceipt(null);
      setReceiptPreview(null);
      setError(`Choose a receipt smaller than ${MAX_API_UPLOAD_LABEL}.`);
      return;
    }
    setReceipt(file);
    setReceiptPreview(
      file?.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    );
    setError(null);
  }

  function continueToReceipt() {
    setError(null);
    if (!location.name.trim())
      return setError("Add the name of your first location.");
    setStep(1);
  }

  async function analyzeReceipt() {
    if (!receipt) return setError("Choose a receipt image or PDF first.");
    setAnalyzing(true);
    setError(null);
    const form = new FormData();
    form.set("receipt", receipt);
    try {
      const response = await fetch("/api/onboarding/receipt", {
        method: "POST",
        body: form,
      });
      const draft = (await response
        .json()
        .catch(() => null)) as ReceiptDraft | null;
      if (!response.ok)
        throw new Error(draft?.error ?? "Unable to read this receipt");

      const receiptId = crypto.randomUUID();
      const supplier = draft?.supplierName?.trim() ?? "";
      setProcessedReceipts((current) => [
        ...current,
        {
          id: receiptId,
          fileName: receipt.name,
          supplierName: supplier,
          receiptDate: draft?.receiptDate ?? "",
          invoiceNumber: draft?.invoiceNumber ?? "",
          confidence: draft?.confidence ?? 0,
          vatAmount: String(draft?.vatAmount ?? 0),
          totalAmount: String(draft?.totalAmount ?? 0),
          warnings: draft?.warnings ?? [],
        },
      ]);
      setItems((current) => [
        ...current,
        ...(draft?.items.length
          ? draft.items.map((item) => ({
              id: crypto.randomUUID(),
              receiptId,
              name: item.name,
              description: item.description,
              category: item.category || "Uncategorized",
              supplier,
              supplierSku: item.supplierSku,
              packageCount: String(item.packageCount),
              unitsPerPackage: String(item.unitsPerPackage),
              quantity: String(item.quantity),
              unit: item.unit || "units",
              minimum: "0",
              packagePrice: String(item.packagePrice),
            }))
          : [newItem(supplier, receiptId)]),
      ]);
      chooseReceipt(null);
    } catch (caught) {
      const receiptId = crypto.randomUUID();
      setProcessedReceipts((current) => [
        ...current,
        {
          id: receiptId,
          fileName: receipt.name,
          supplierName: "",
          receiptDate: "",
          invoiceNumber: "",
          confidence: 0,
          vatAmount: "0",
          totalAmount: "0",
          warnings: [
            caught instanceof Error
              ? caught.message
              : "OCR could not finish. Review the fields manually.",
          ],
        },
      ]);
      setItems((current) => [...current, newItem("", receiptId)]);
      chooseReceipt(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function updateReceipt(
    id: string,
    key:
      | "supplierName"
      | "receiptDate"
      | "invoiceNumber"
      | "vatAmount"
      | "totalAmount",
    value: string,
  ) {
    setProcessedReceipts((current) =>
      current.map((receipt) =>
        receipt.id === id ? { ...receipt, [key]: value } : receipt,
      ),
    );
    if (key !== "supplierName") return;
    setItems((current) =>
      current.map((item) =>
        item.receiptId === id ? { ...item, supplier: value } : item,
      ),
    );
  }

  function removeReceipt(id: string) {
    setProcessedReceipts((current) =>
      current.filter((receipt) => receipt.id !== id),
    );
    setItems((current) => current.filter((item) => item.receiptId !== id));
  }

  function updateItem(id: string, key: keyof SetupItem, value: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
              ...(["packageCount", "unitsPerPackage"].includes(key)
                ? {
                    quantity: String(
                      Number(
                        (
                          Number(
                            key === "packageCount" ? value : item.packageCount,
                          ) *
                          Number(
                            key === "unitsPerPackage"
                              ? value
                              : item.unitsPerPackage,
                          )
                        ).toFixed(3),
                      ),
                    ),
                  }
                : {}),
            }
          : item,
      ),
    );
  }

  function assignItemSupplier(id: string, supplier: string) {
    const receiptId =
      processedReceipts.find((receipt) => receipt.supplierName === supplier)
        ?.id ?? "";
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, supplier, receiptId } : item,
      ),
    );
  }

  async function finish() {
    setError(null);
    if (
      !processedReceipts.length ||
      processedReceipts.some((receipt) => !receipt.supplierName.trim())
    )
      return setError("Confirm the supplier name for every receipt.");
    const incomplete = items.some(
      (item) =>
        !item.name.trim() ||
        !item.category.trim() ||
        !item.unit.trim() ||
        !Number.isFinite(Number(item.packageCount)) ||
        Number(item.packageCount) < 0 ||
        !Number.isFinite(Number(item.unitsPerPackage)) ||
        Number(item.unitsPerPackage) <= 0 ||
        !Number.isFinite(Number(item.quantity)) ||
        !Number.isFinite(Number(item.minimum)) ||
        !Number.isFinite(Number(item.packagePrice)),
    );
    if (incomplete)
      return setError("Complete the required fields for every receipt line.");

    setPending(true);
    try {
      const response = await fetch("/api/onboarding/base-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location,
          append: existingSetup,
          timezone,
          currency,
          suppliers: [
            ...new Set(
              processedReceipts.map((receipt) => receipt.supplierName.trim()),
            ),
          ],
          receipts: processedReceipts.map((receipt) => ({
            supplier: receipt.supplierName.trim(),
            fileName: receipt.fileName,
            receiptDate: receipt.receiptDate,
            invoiceNumber: receipt.invoiceNumber,
            confidence: receipt.confidence,
            vatAmount: Number(receipt.vatAmount),
            totalAmount: Number(receipt.totalAmount),
          })),
          items: items.map((item) => ({
            name: item.name,
            description: item.description,
            category: item.category,
            supplier: item.supplier.trim(),
            supplierSku: item.supplierSku,
            packageCount: Number(item.packageCount),
            unitsPerPackage: Number(item.unitsPerPackage),
            quantity: Number(item.quantity),
            unit: item.unit,
            minimum: Number(item.minimum),
            packagePrice: Number(item.packagePrice),
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Unable to save setup");
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
      router.push(existingSetup ? "/receipts" : "/inventory");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save setup",
      );
      setPending(false);
    }
  }

  return (
    <main className="setup-page">
      <section className="setup-shell">
        <header className="setup-header">
          <div className="setup-brand">
            supplai<span>.</span>
          </div>
          <p>
            {existingSetup
              ? `RECEIPT IMPORT · ${companyName}`
              : `Welcome, ${companyName}`}
          </p>
          <h1>
            {existingSetup
              ? "Scan and review supplier receipts."
              : "Let’s build your inventory foundation."}
          </h1>
          <span>
            {existingSetup
              ? "Add new supplier purchases to your live inventory without reopening company setup."
              : "Upload one receipt per supplier. Supplai combines the catalog."}
          </span>
        </header>

        <div className="setup-progress" aria-label="Setup progress">
          {flowSteps.map(({ label, icon: Icon }, index) => (
            <div className={index <= step ? "active" : ""} key={label}>
              <span>{index < step ? <Check /> : <Icon />}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        <section className="setup-card">
          {step === 0 ? (
            <div className="setup-step">
              <div className="setup-step-title">
                <Building2 />
                <div>
                  <h2>Your first location</h2>
                  <p>Set the defaults used for stock and reporting.</p>
                </div>
              </div>
              <div className="setup-fields two-columns">
                <label>
                  Location name
                  <input
                    value={location.name}
                    onChange={(event) =>
                      setLocation({ ...location, name: event.target.value })
                    }
                    placeholder="Main café"
                  />
                </label>
                <label>
                  Address <span>Optional</span>
                  <input
                    value={location.address}
                    onChange={(event) =>
                      setLocation({ ...location, address: event.target.value })
                    }
                    placeholder="Street and city"
                  />
                </label>
                <label>
                  Timezone
                  <select
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  >
                    <option value="Asia/Jerusalem">Asia/Jerusalem</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">
                      America/Los_Angeles
                    </option>
                  </select>
                </label>
                <label>
                  Currency
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  >
                    <option value="ILS">ILS — ₪</option>
                    <option value="USD">USD — $</option>
                    <option value="EUR">EUR — €</option>
                    <option value="GBP">GBP — £</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="setup-step receipt-setup-step">
              <div className="setup-step-title">
                <ReceiptText />
                <div>
                  <h2>Upload one receipt per supplier</h2>
                  <p>Extract each receipt, then review the combined catalog.</p>
                </div>
              </div>
              {processedReceipts.length ? (
                <div className="processed-receipts">
                  <div className="processed-receipts-heading">
                    <span>Receipts ready for review</span>
                    <strong>{processedReceipts.length}</strong>
                  </div>
                  {processedReceipts.map((processed) => (
                    <article key={processed.id}>
                      <span>
                        <Check />
                      </span>
                      <div>
                        <strong>
                          {processed.supplierName || "Supplier needs review"}
                        </strong>
                        <small>
                          {processed.fileName} ·{" "}
                          {
                            items.filter(
                              (item) => item.receiptId === processed.id,
                            ).length
                          }{" "}
                          lines
                        </small>
                      </div>
                      <Button
                        aria-label={`Remove ${processed.fileName}`}
                        onClick={() => removeReceipt(processed.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <X />
                      </Button>
                    </article>
                  ))}
                </div>
              ) : null}
              <label
                className={`receipt-dropzone ${receipt ? "has-file" : ""}`}
              >
                <input
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  onChange={(event) =>
                    chooseReceipt(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                {receiptPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Receipt preview" src={receiptPreview} />
                ) : receipt ? (
                  <>
                    <FileText />
                    <strong>{receipt.name}</strong>
                    <span>Ready for extraction</span>
                  </>
                ) : (
                  <>
                    <ImagePlus />
                    <strong>Drop a receipt here or choose a file</strong>
                    <span>Photo or PDF · up to {MAX_API_UPLOAD_LABEL}</span>
                  </>
                )}
              </label>
              {receipt ? (
                <div className="receipt-file-summary">
                  <div>
                    <ReceiptText />
                    <span>{receipt.name}</span>
                    <small>
                      {Math.max(1, Math.round(receipt.size / 1024))} KB
                    </small>
                  </div>
                  <Button
                    disabled={analyzing}
                    onClick={analyzeReceipt}
                    type="button"
                  >
                    {analyzing ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      <Sparkles />
                    )}
                    {analyzing ? "Reading receipt…" : "Extract and add receipt"}
                  </Button>
                </div>
              ) : null}
              <p className="receipt-privacy-note">
                The receipt is sent to Gemini for extraction and is not stored
                by Supplai.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="setup-step inventory-setup-step">
              <div className="setup-step-title">
                <PackageCheck />
                <div>
                  <h2>Review the extracted data</h2>
                  <p>Correct anything OCR missed before creating inventory.</p>
                </div>
              </div>

              <div className="receipt-review-list">
                {processedReceipts.map((processed) => (
                  <div key={processed.id}>
                    <div className="receipt-review-summary">
                      <label>
                        Supplier
                        <input
                          onChange={(event) =>
                            updateReceipt(
                              processed.id,
                              "supplierName",
                              event.target.value,
                            )
                          }
                          placeholder="Supplier name"
                          value={processed.supplierName}
                        />
                      </label>
                      <label>
                        Receipt date <span>Optional</span>
                        <input
                          onChange={(event) =>
                            updateReceipt(
                              processed.id,
                              "receiptDate",
                              event.target.value,
                            )
                          }
                          placeholder="YYYY-MM-DD"
                          value={processed.receiptDate}
                        />
                      </label>
                      <label>
                        Invoice number <span>Optional</span>
                        <input
                          onChange={(event) =>
                            updateReceipt(
                              processed.id,
                              "invoiceNumber",
                              event.target.value,
                            )
                          }
                          value={processed.invoiceNumber}
                        />
                      </label>
                      <label>
                        VAT amount <span>Optional</span>
                        <input
                          min="0"
                          onChange={(event) =>
                            updateReceipt(
                              processed.id,
                              "vatAmount",
                              event.target.value,
                            )
                          }
                          step="0.01"
                          type="number"
                          value={processed.vatAmount}
                        />
                      </label>
                      <label>
                        Receipt total <span>Optional</span>
                        <input
                          min="0"
                          onChange={(event) =>
                            updateReceipt(
                              processed.id,
                              "totalAmount",
                              event.target.value,
                            )
                          }
                          step="0.01"
                          type="number"
                          value={processed.totalAmount}
                        />
                      </label>
                      <div className="ocr-confidence">
                        <Sparkles />
                        <span>OCR confidence</span>
                        <strong>
                          {displayPercent(processed.confidence * 100)}
                        </strong>
                      </div>
                    </div>
                    {processed.warnings.length ? (
                      <div className="ocr-warning">
                        <strong>
                          Check {displayText(processed.fileName, "receipt")}
                        </strong>
                        <span>
                          {processed.warnings
                            .map((warning) => displayText(warning, ""))
                            .filter(Boolean)
                            .join(" · ") || "Review the extracted values"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="base-item-list">
                {items.map((item, index) => (
                  <article className="base-item-card" key={item.id}>
                    <div className="base-item-heading">
                      <strong>Receipt line {index + 1}</strong>
                      {items.length > 1 ? (
                        <Button
                          aria-label="Remove item"
                          onClick={() =>
                            setItems((current) =>
                              current.filter(
                                (currentItem) => currentItem.id !== item.id,
                              ),
                            )
                          }
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <X />
                        </Button>
                      ) : null}
                    </div>
                    <div className="setup-fields base-item-fields receipt-item-fields">
                      <label>
                        Item name
                        <input
                          value={item.name}
                          onChange={(event) =>
                            updateItem(item.id, "name", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Category
                        <input
                          value={item.category}
                          onChange={(event) =>
                            updateItem(item.id, "category", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Supplier
                        <select
                          value={item.supplier}
                          onChange={(event) =>
                            assignItemSupplier(item.id, event.target.value)
                          }
                        >
                          {processedReceipts.map((processed) => (
                            <option
                              key={processed.id}
                              value={processed.supplierName}
                            >
                              {processed.supplierName ||
                                "Supplier needs review"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Unit
                        <input
                          value={item.unit}
                          onChange={(event) =>
                            updateItem(item.id, "unit", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Packages bought
                        <input
                          min="0"
                          step="1"
                          type="number"
                          value={item.packageCount}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "packageCount",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Units per package
                        <input
                          min="0.001"
                          step="0.001"
                          type="number"
                          value={item.unitsPerPackage}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "unitsPerPackage",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Total received
                        <input
                          aria-describedby={`received-total-${item.id}`}
                          readOnly
                          type="number"
                          value={item.quantity}
                        />
                        <span id={`received-total-${item.id}`}>
                          Packages × units per package
                        </span>
                      </label>
                      <label>
                        Minimum stock
                        <input
                          min="0"
                          step="0.5"
                          type="number"
                          value={item.minimum}
                          onChange={(event) =>
                            updateItem(item.id, "minimum", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Package price
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.packagePrice}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "packagePrice",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="base-item-description">
                        Description <span>Optional</span>
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "description",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
                <Button
                  onClick={() => {
                    const firstReceipt = processedReceipts[0];
                    setItems((current) => [
                      ...current,
                      newItem(
                        firstReceipt?.supplierName ?? "",
                        firstReceipt?.id ?? "",
                      ),
                    ]);
                  }}
                  type="button"
                  variant="outline"
                >
                  <Plus /> Add a missing line
                </Button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="setup-error" role="alert">
              {error}
            </p>
          ) : null}
          <footer className="setup-actions">
            {step > 0 && !(existingSetup && step === 1) ? (
              <Button
                disabled={pending || analyzing}
                onClick={() => {
                  setError(null);
                  setStep((current) => current - 1);
                }}
                type="button"
                variant="ghost"
              >
                <ArrowLeft /> Back
              </Button>
            ) : (
              <span />
            )}
            {step === 0 ? (
              <Button onClick={continueToReceipt} type="button">
                Continue <ArrowRight />
              </Button>
            ) : null}
            {step === 1 && !receipt && processedReceipts.length ? (
              <Button onClick={() => setStep(2)} type="button">
                Review {processedReceipts.length} supplier
                {processedReceipts.length === 1 ? "" : "s"} <ArrowRight />
              </Button>
            ) : null}
            {step === 1 && !receipt && !processedReceipts.length ? (
              <Button disabled type="button">
                Add your first supplier receipt
              </Button>
            ) : null}
            {step === 2 ? (
              <Button disabled={pending} onClick={finish} type="button">
                {pending ? "Creating inventory…" : "Approve and finish"}
                {!pending ? <Check /> : null}
              </Button>
            ) : null}
          </footer>
        </section>
      </section>
    </main>
  );
}
