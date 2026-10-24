-- CreateTable
CREATE TABLE "HomepageFeaturedSet" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomepageFeaturedSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomepageFeaturedSet_category_order_idx" ON "HomepageFeaturedSet"("category", "order");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageFeaturedSet_category_cardSetId_key" ON "HomepageFeaturedSet"("category", "cardSetId");

-- AddForeignKey
ALTER TABLE "HomepageFeaturedSet" ADD CONSTRAINT "HomepageFeaturedSet_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
