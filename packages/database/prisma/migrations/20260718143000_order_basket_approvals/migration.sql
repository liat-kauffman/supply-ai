CREATE TYPE "OrderBasketRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "OrderBasketRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "OrderBasketRequestStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "OrderBasketRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderBasketRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "supplierSku" TEXT,
    "unit" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(12,3) NOT NULL,
    "unitsPerPackage" DECIMAL(12,3) NOT NULL,
    "packageCount" INTEGER NOT NULL,
    "latestPackagePrice" DECIMAL(12,2),
    "estimatedCost" DECIMAL(12,2),

    CONSTRAINT "OrderBasketRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderBasketRequest_businessId_status_createdAt_idx" ON "OrderBasketRequest"("businessId", "status", "createdAt");
CREATE INDEX "OrderBasketRequest_requestedById_status_idx" ON "OrderBasketRequest"("requestedById", "status");
CREATE INDEX "OrderBasketRequest_supplierId_status_idx" ON "OrderBasketRequest"("supplierId", "status");
CREATE UNIQUE INDEX "OrderBasketRequestLine_requestId_productId_key" ON "OrderBasketRequestLine"("requestId", "productId");
CREATE INDEX "OrderBasketRequestLine_productId_idx" ON "OrderBasketRequestLine"("productId");

ALTER TABLE "OrderBasketRequest" ADD CONSTRAINT "OrderBasketRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBasketRequest" ADD CONSTRAINT "OrderBasketRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderBasketRequest" ADD CONSTRAINT "OrderBasketRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderBasketRequest" ADD CONSTRAINT "OrderBasketRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderBasketRequestLine" ADD CONSTRAINT "OrderBasketRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OrderBasketRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderBasketRequestLine" ADD CONSTRAINT "OrderBasketRequestLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
