-- AlterEnum
ALTER TYPE "ReceiptStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "postedById" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- CreateIndex
CREATE INDEX "stock_movements_receiptId_idx" ON "stock_movements"("receiptId");

-- CreateIndex
CREATE INDEX "stock_movements_receiptLineId_idx" ON "stock_movements"("receiptLineId");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
