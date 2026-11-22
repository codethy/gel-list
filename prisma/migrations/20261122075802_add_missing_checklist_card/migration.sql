-- CreateTable
CREATE TABLE "MissingChecklistCard" (
    "id" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "team" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MissingChecklistCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissingChecklistCard_cardSetId_idx" ON "MissingChecklistCard"("cardSetId");

-- CreateIndex
CREATE INDEX "MissingChecklistCard_isResolved_idx" ON "MissingChecklistCard"("isResolved");

-- AddForeignKey
ALTER TABLE "MissingChecklistCard" ADD CONSTRAINT "MissingChecklistCard_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
