-- DropIndex
DROP INDEX "ChecklistCard_cardSetId_cardNumber_parallel_key";

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCard_cardSetId_cardNumber_parallel_variationName_key" ON "ChecklistCard"("cardSetId", "cardNumber", "parallel", "variationName");
