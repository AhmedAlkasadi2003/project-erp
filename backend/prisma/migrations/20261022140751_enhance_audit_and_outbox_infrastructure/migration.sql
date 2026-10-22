/*
  Warnings:

  - Added the required column `updatedAt` to the `outbox_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OutboxStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OutboxStatus" ADD VALUE 'DEAD_LETTER';

-- DropIndex
DROP INDEX "outbox_events_status_createdAt_idx";

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "correlationId" TEXT;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "eventVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "audit_events_companyId_createdAt_idx" ON "audit_events"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextRetryAt_createdAt_idx" ON "outbox_events"("status", "nextRetryAt", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_lockedAt_idx" ON "outbox_events"("lockedAt");
