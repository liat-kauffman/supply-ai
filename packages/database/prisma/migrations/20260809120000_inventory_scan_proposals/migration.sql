CREATE TABLE "InventoryScan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storageAreaId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "observations" JSONB NOT NULL,
    "globalWarnings" JSONB NOT NULL,
    "unrecognizedItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryScan_businessId_status_createdAt_idx" ON "InventoryScan"("businessId", "status", "createdAt");
CREATE INDEX "InventoryScan_createdById_createdAt_idx" ON "InventoryScan"("createdById", "createdAt");

ALTER TABLE "InventoryScan" ADD CONSTRAINT "InventoryScan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryScan" ADD CONSTRAINT "InventoryScan_storageAreaId_fkey" FOREIGN KEY ("storageAreaId") REFERENCES "StorageArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryScan" ADD CONSTRAINT "InventoryScan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "InventoryScan" ADD CONSTRAINT "InventoryScan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON UPDATE CASCADE;
