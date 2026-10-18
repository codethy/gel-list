-- Adds JUMBO_BOX to ProductType, and a new SetProduct table: the
-- admin-curated per-set product catalog (Hobby Box, Jumbo Box, etc.) that
-- powers the "Which Product" dropdown in the Log a Gel form.

-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'JUMBO_BOX';

-- CreateTable
CREATE TABLE "SetProduct" (
    "id" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "productTypeOther" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetProduct_cardSetId_idx" ON "SetProduct"("cardSetId");

-- AddForeignKey
ALTER TABLE "SetProduct" ADD CONSTRAINT "SetProduct_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
