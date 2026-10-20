-- Adds FavoriteGel: a user's hand-picked "Favorite Gels" shown on their
-- profile page (max 6, enforced in app code), with an `order` column
-- driving the display sequence.

-- CreateTable
CREATE TABLE "FavoriteGel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioCardId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteGel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteGel_userId_order_idx" ON "FavoriteGel"("userId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteGel_userId_portfolioCardId_key" ON "FavoriteGel"("userId", "portfolioCardId");

-- AddForeignKey
ALTER TABLE "FavoriteGel" ADD CONSTRAINT "FavoriteGel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteGel" ADD CONSTRAINT "FavoriteGel_portfolioCardId_fkey" FOREIGN KEY ("portfolioCardId") REFERENCES "PortfolioCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
