CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "receiptDate" TIMESTAMP(3) NOT NULL,
  "invoiceNumber" TEXT,
  "fileName" TEXT,
  "confidence" DECIMAL(5,4),
  "currency" TEXT NOT NULL DEFAULT 'ILS',
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReceiptLine" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierProductId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "supplierSku" TEXT,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "packagePrice" DECIMAL(12,2),
  "lineTotal" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Receipt_businessId_receiptDate_idx" ON "Receipt"("businessId", "receiptDate");
CREATE INDEX "Receipt_supplierId_receiptDate_idx" ON "Receipt"("supplierId", "receiptDate");
CREATE INDEX "ReceiptLine_receiptId_idx" ON "ReceiptLine"("receiptId");
CREATE INDEX "ReceiptLine_productId_idx" ON "ReceiptLine"("productId");

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "SupplierProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
