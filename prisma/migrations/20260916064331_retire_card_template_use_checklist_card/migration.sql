/*
  Warnings:

  - You are about to drop the column `cardTemplateId` on the `CardTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `cardTemplateId` on the `PortfolioCard` table. All the data in the column will be lost.
  - You are about to drop the column `cardTemplateId` on the `UnverifiedHit` table. All the data in the column will be lost.
  - You are about to drop the `CardTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CardTemplateLike` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `checklistCardId` to the `CardTransfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `checklistCardId` to the `PortfolioCard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `checklistCardId` to the `UnverifiedHit` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CardTemplate" DROP CONSTRAINT "CardTemplate_cardSetId_fkey";

-- DropForeignKey
ALTER TABLE "CardTemplateLike" DROP CONSTRAINT "CardTemplateLike_cardTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "CardTemplateLike" DROP CONSTRAINT "CardTemplateLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "CardTransfer" DROP CONSTRAINT "CardTransfer_cardTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "PortfolioCard" DROP CONSTRAINT "PortfolioCard_cardTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "UnverifiedHit" DROP CONSTRAINT "UnverifiedHit_cardTemplateId_fkey";

-- AlterTable
ALTER TABLE "CardTransfer" DROP COLUMN "cardTemplateId",
ADD COLUMN     "checklistCardId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PortfolioCard" DROP COLUMN "cardTemplateId",
ADD COLUMN     "checklistCardId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UnverifiedHit" DROP COLUMN "cardTemplateId",
ADD COLUMN     "checklistCardId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CardTemplate";

-- DropTable
DROP TABLE "CardTemplateLike";

-- CreateTable
CREATE TABLE "ChecklistCardLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checklistCardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistCardLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCardLike_userId_checklistCardId_key" ON "ChecklistCardLike"("userId", "checklistCardId");

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_checklistCardId_fkey" FOREIGN KEY ("checklistCardId") REFERENCES "ChecklistCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnverifiedHit" ADD CONSTRAINT "UnverifiedHit_checklistCardId_fkey" FOREIGN KEY ("checklistCardId") REFERENCES "ChecklistCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransfer" ADD CONSTRAINT "CardTransfer_checklistCardId_fkey" FOREIGN KEY ("checklistCardId") REFERENCES "ChecklistCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistCardLike" ADD CONSTRAINT "ChecklistCardLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistCardLike" ADD CONSTRAINT "ChecklistCardLike_checklistCardId_fkey" FOREIGN KEY ("checklistCardId") REFERENCES "ChecklistCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
