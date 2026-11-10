-- AlterTable
ALTER TABLE "PortfolioCard" ADD COLUMN     "breakerProfileId" TEXT;

-- CreateTable
CREATE TABLE "BreakerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isOfficialToppsPartner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakerProductOpening" (
    "id" TEXT NOT NULL,
    "breakerProfileId" TEXT NOT NULL,
    "setProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakerProductOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BreakerProfile_name_key" ON "BreakerProfile"("name");

-- CreateIndex
CREATE INDEX "BreakerProductOpening_breakerProfileId_idx" ON "BreakerProductOpening"("breakerProfileId");

-- CreateIndex
CREATE INDEX "BreakerProductOpening_setProductId_idx" ON "BreakerProductOpening"("setProductId");

-- CreateIndex
CREATE INDEX "PortfolioCard_breakerProfileId_idx" ON "PortfolioCard"("breakerProfileId");

-- AddForeignKey
ALTER TABLE "BreakerProductOpening" ADD CONSTRAINT "BreakerProductOpening_breakerProfileId_fkey" FOREIGN KEY ("breakerProfileId") REFERENCES "BreakerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreakerProductOpening" ADD CONSTRAINT "BreakerProductOpening_setProductId_fkey" FOREIGN KEY ("setProductId") REFERENCES "SetProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_breakerProfileId_fkey" FOREIGN KEY ("breakerProfileId") REFERENCES "BreakerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
