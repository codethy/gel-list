-- CreateTable
CREATE TABLE "ProductPackKind" (
    "id" TEXT NOT NULL,
    "setProductId" TEXT NOT NULL,
    "packsCount" INTEGER NOT NULL,
    "cardsPerPack" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPackKind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOpening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "setProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPackKind_setProductId_idx" ON "ProductPackKind"("setProductId");

-- CreateIndex
CREATE INDEX "ProductOpening_cardSetId_idx" ON "ProductOpening"("cardSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOpening_userId_setProductId_key" ON "ProductOpening"("userId", "setProductId");

-- AddForeignKey
ALTER TABLE "ProductPackKind" ADD CONSTRAINT "ProductPackKind_setProductId_fkey" FOREIGN KEY ("setProductId") REFERENCES "SetProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOpening" ADD CONSTRAINT "ProductOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOpening" ADD CONSTRAINT "ProductOpening_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOpening" ADD CONSTRAINT "ProductOpening_setProductId_fkey" FOREIGN KEY ("setProductId") REFERENCES "SetProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
