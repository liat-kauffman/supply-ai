"use client";

import {
  Camera,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayPercent } from "@/lib/display";
import type { InventoryItem } from "./inventory-data";

type Observation = {
  productId: string;
  name: string;
  unit: string;
  count: number;
  confidence: number;
  evidence: string;
  warnings: string[];
};

export function AreaPhotoScanner({
  canApprove,
  onApplied,
  onClose,
  storageAreas,
}: {
  canApprove: boolean;
  onApplied: (items: InventoryItem[]) => void;
  onClose: () => void;
  storageAreas: Array<{ id: string; name: string; location: { name: string } }>;
}) {
  const [storageAreaId, setStorageAreaId] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [unrecognizedItems, setUnrecognizedItems] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function choosePhoto(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    setObservations([]);
    setSelected({});
    setUnrecognizedItems([]);
    setWarnings([]);
    setError(null);
  }

  async function analyze() {
    if (!photo) return;
    setIsAnalyzing(true);
    setError(null);
    const form = new FormData();
    form.set("image", photo);
    if (storageAreaId) form.set("storageAreaId", storageAreaId);
    try {
      const response = await fetch("/api/inventory/area-photo", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        scanId?: string;
        observations?: Observation[];
        unrecognizedItems?: string[];
        globalWarnings?: string[];
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Unable to analyze this area photo");
      const nextObservations = payload?.observations ?? [];
      setObservations(nextObservations);
      setScanId(payload?.scanId ?? null);
      setSelected(
        Object.fromEntries(
          nextObservations.map((observation) => [observation.productId, true]),
        ),
      );
      setUnrecognizedItems(payload?.unrecognizedItems ?? []);
      setWarnings(payload?.globalWarnings ?? []);
      if (!nextObservations.length)
        setError(
          "No catalog products were confidently identified. Try a wider, brighter photo.",
        );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to analyze this area photo",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function changeCount(productId: string, count: string) {
    const nextCount = Number(count);
    if (!Number.isFinite(nextCount) || nextCount < 0) return;
    setObservations((current) =>
      current.map((observation) =>
        observation.productId === productId
          ? { ...observation, count: nextCount }
          : observation,
      ),
    );
  }

  async function approve() {
    const counts = observations
      .filter((observation) => selected[observation.productId])
      .map((observation) => ({
        productId: observation.productId,
        quantity: observation.count,
      }));
    if (!counts.length) return;
    setIsApproving(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory/area-photo/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ counts, scanId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        items?: InventoryItem[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.items)
        throw new Error(payload?.error ?? "Unable to approve these counts");
      onApplied(payload.items);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to approve these counts",
      );
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="inventory-modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="area-photo-title"
        aria-modal="true"
        className="inventory-modal area-photo-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="inventory-modal-heading">
          <div>
            <p className="eyebrow">AI STOCK COUNT</p>
            <h2 id="area-photo-title">Scan a storage area</h2>
            <span>
              AI identifies products from your catalog and proposes visible
              counts.
            </span>
          </div>
          <Button
            aria-label="Close area scanner"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X />
          </Button>
        </div>

        <div className="area-photo-content">
          <p className="area-photo-disclaimer">
            Review every proposal carefully. The scan never changes inventory
            until you approve it.
          </p>
          <label className="area-photo-select">
            <span>Which area is in the photo?</span>
            <select
              value={storageAreaId}
              onChange={(event) => setStorageAreaId(event.target.value)}
            >
              <option value="">All active inventory items</option>
              {storageAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.location.name} · {area.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`photo-dropzone ${preview ? "has-photo" : ""}`}>
            <input
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
              type="file"
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Storage area preview" src={preview} />
            ) : (
              <>
                <ImagePlus />
                <strong>Take or upload an area photo</strong>
                <span>
                  Include the full shelf or storage area · up to 10 MB
                </span>
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
                disabled={isAnalyzing}
                onClick={analyze}
                size="sm"
                type="button"
              >
                {isAnalyzing ? <LoaderCircle className="spin" /> : <Sparkles />}
                {isAnalyzing ? "Analyzing…" : "Analyze area"}
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="photo-count-error" role="alert">
              {error}
            </p>
          ) : null}
          {observations.length ? (
            <div className="area-photo-results">
              <div className="item-section-heading">
                <span className="item-section-icon">
                  <Camera />
                </span>
                <div>
                  <h3>Review detected products</h3>
                  <p>
                    Uncheck anything you do not want to update, then adjust
                    counts if needed.
                  </p>
                </div>
              </div>
              <div className="area-photo-list">
                {observations.map((observation) => (
                  <label className="area-photo-row" key={observation.productId}>
                    <input
                      checked={Boolean(selected[observation.productId])}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [observation.productId]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <div className="area-photo-product">
                      <strong>{observation.name}</strong>
                      <span>{observation.evidence}</span>
                      {observation.warnings.length ? (
                        <small>{observation.warnings.join(" · ")}</small>
                      ) : null}
                    </div>
                    <input
                      aria-label={`Count for ${observation.name}`}
                      min="0"
                      onChange={(event) =>
                        changeCount(observation.productId, event.target.value)
                      }
                      step="0.5"
                      type="number"
                      value={observation.count}
                    />
                    <span className="area-photo-unit">{observation.unit}</span>
                    <Badge variant="outline">
                      {displayPercent(observation.confidence * 100)}
                    </Badge>
                  </label>
                ))}
              </div>
              {warnings.length || unrecognizedItems.length ? (
                <div className="area-photo-warnings">
                  {[
                    ...warnings,
                    ...unrecognizedItems.map((item) => `Unrecognized: ${item}`),
                  ].map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </div>
              ) : null}
              <div className="area-photo-actions">
                <span>
                  {Object.values(selected).filter(Boolean).length} product
                  counts selected
                </span>
                {canApprove ? (
                  <Button
                    disabled={
                      isApproving || !Object.values(selected).some(Boolean)
                    }
                    onClick={approve}
                    type="button"
                  >
                    {isApproving ? "Saving…" : `Approve selected counts`}
                  </Button>
                ) : (
                  <small className="photo-count-manager-note">
                    A manager must approve these counts before inventory is
                    updated.
                  </small>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
