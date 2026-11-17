-- CreateEnum
CREATE TYPE "EqlResultStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "EqlSet" (
    "id" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EqlSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EqlProduct" (
    "id" TEXT NOT NULL,
    "eqlSetId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "productTypeOther" TEXT,
    "maxQuantity" INTEGER NOT NULL,
    "estimatedPrintRun" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EqlProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EqlResult" (
    "id" TEXT NOT NULL,
    "eqlSetId" TEXT NOT NULL,
    "eqlProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "EqlResultStatus" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EqlResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EqlSet_cardSetId_key" ON "EqlSet"("cardSetId");

-- CreateIndex
CREATE INDEX "EqlProduct_eqlSetId_idx" ON "EqlProduct"("eqlSetId");

-- CreateIndex
CREATE INDEX "EqlResult_eqlSetId_status_idx" ON "EqlResult"("eqlSetId", "status");

-- CreateIndex
CREATE INDEX "EqlResult_userId_idx" ON "EqlResult"("userId");

-- AddForeignKey
ALTER TABLE "EqlSet" ADD CONSTRAINT "EqlSet_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqlProduct" ADD CONSTRAINT "EqlProduct_eqlSetId_fkey" FOREIGN KEY ("eqlSetId") REFERENCES "EqlSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqlResult" ADD CONSTRAINT "EqlResult_eqlSetId_fkey" FOREIGN KEY ("eqlSetId") REFERENCES "EqlSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqlResult" ADD CONSTRAINT "EqlResult_eqlProductId_fkey" FOREIGN KEY ("eqlProductId") REFERENCES "EqlProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EqlResult" ADD CONSTRAINT "EqlResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
