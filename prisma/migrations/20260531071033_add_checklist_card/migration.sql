-- CreateTable
CREATE TABLE "ChecklistCard" (
    "id" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "isHit" BOOLEAN NOT NULL DEFAULT false,
    "isChase" BOOLEAN NOT NULL DEFAULT false,
    "parallelType" TEXT,
    "serialNumber" INTEGER,
    "variation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCard_cardSetId_cardNumber_parallelType_key" ON "ChecklistCard"("cardSetId", "cardNumber", "parallelType");

-- AddForeignKey
ALTER TABLE "ChecklistCard" ADD CONSTRAINT "ChecklistCard_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
