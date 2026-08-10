-- DropForeignKey
ALTER TABLE "InventoryScan" DROP CONSTRAINT "InventoryScan_createdById_fkey";

-- DropForeignKey
ALTER TABLE "InventoryScan" DROP CONSTRAINT "InventoryScan_reviewedById_fkey";

-- AddForeignKey
ALTER TABLE "InventoryScan" ADD CONSTRAINT "InventoryScan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryScan" ADD CONSTRAINT "InventoryScan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
