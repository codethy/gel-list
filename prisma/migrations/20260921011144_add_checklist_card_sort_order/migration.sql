-- AlterTable
ALTER TABLE "ChecklistCard" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ChecklistCard_cardSetId_sortOrder_idx" ON "ChecklistCard"("cardSetId", "sortOrder");
