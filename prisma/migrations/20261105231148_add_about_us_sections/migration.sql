-- CreateTable
CREATE TABLE "AboutUsSection" (
    "id" TEXT NOT NULL,
    "heading" TEXT,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AboutUsSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AboutUsSection_order_idx" ON "AboutUsSection"("order");
