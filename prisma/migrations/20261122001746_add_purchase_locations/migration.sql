-- AlterTable
ALTER TABLE "PortfolioCard" ADD COLUMN     "purchaseLocation" VARCHAR(255);

-- CreateTable
CREATE TABLE "SetPurchaseLocation" (
    "id" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetPurchaseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetPurchaseLocation_cardSetId_idx" ON "SetPurchaseLocation"("cardSetId");

-- CreateIndex
CREATE UNIQUE INDEX "SetPurchaseLocation_cardSetId_label_key" ON "SetPurchaseLocation"("cardSetId", "label");

-- AddForeignKey
ALTER TABLE "SetPurchaseLocation" ADD CONSTRAINT "SetPurchaseLocation_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
