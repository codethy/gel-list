-- CreateTable
CREATE TABLE "YourGelsPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "portfolioCardId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YourGelsPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YourGelsPin_userId_cardSetId_order_idx" ON "YourGelsPin"("userId", "cardSetId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "YourGelsPin_userId_portfolioCardId_key" ON "YourGelsPin"("userId", "portfolioCardId");

-- AddForeignKey
ALTER TABLE "YourGelsPin" ADD CONSTRAINT "YourGelsPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YourGelsPin" ADD CONSTRAINT "YourGelsPin_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YourGelsPin" ADD CONSTRAINT "YourGelsPin_portfolioCardId_fkey" FOREIGN KEY ("portfolioCardId") REFERENCES "PortfolioCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
