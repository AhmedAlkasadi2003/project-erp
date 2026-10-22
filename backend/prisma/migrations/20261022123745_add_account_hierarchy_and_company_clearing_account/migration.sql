-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "grnClearingAccountId" TEXT;

-- CreateIndex
CREATE INDEX "accounts_parentId_idx" ON "accounts"("parentId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_grnClearingAccountId_fkey" FOREIGN KEY ("grnClearingAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
