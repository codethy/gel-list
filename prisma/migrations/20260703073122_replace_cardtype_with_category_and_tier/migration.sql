/*
  Warnings:

  - You are about to drop the column `cardType` on the `CardTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `cardType` on the `ChecklistCard` table. All the data in the column will be lost.
  - You are about to drop the column `parallelType` on the `ChecklistCard` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumber` on the `ChecklistCard` table. All the data in the column will be lost.
  - You are about to drop the column `variation` on the `ChecklistCard` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cardSetId,cardNumber,parallelColor]` on the table `ChecklistCard` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cardCategory` to the `CardTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cardTier` to the `CardTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cardCategory` to the `ChecklistCard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cardTier` to the `ChecklistCard` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('BASE', 'PARALLEL', 'AUTO', 'RELIC', 'AUTO_RELIC', 'FACSIMILE_AUTO', 'SHORT_PRINT', 'SUPER_SHORT_PRINT', 'CASE_HIT', 'PROMO', 'COMMON', 'UNCOMMON', 'RARE', 'DOUBLE_RARE', 'ULTRA_RARE', 'ILLUSTRATION_RARE', 'SPECIAL_ILLUSTRATION_RARE', 'HYPER_RARE', 'MEGA_HYPER_RARE', 'ACE_SPEC_RARE', 'SHINY_RARE', 'SHINY_ULTRA_RARE', 'SUPER_RARE', 'LEGENDARY', 'EPIC', 'ENCHANTED', 'ICONIC', 'ALT_ART', 'OVERNUMBERED', 'MYTHIC', 'SECRET_RARE', 'LEADER', 'SPECIAL', 'ULTIMATE_RARE', 'GHOST_RARE', 'TCG_PROMO');

-- CreateEnum
CREATE TYPE "CardTier" AS ENUM ('UNLIMITED', 'LIMITED', 'NUMBERED', 'ONE_OF_ONE', 'SHORT_PRINT', 'SUPER_SHORT_PRINT', 'CASE_HIT');

-- DropIndex
DROP INDEX "ChecklistCard_cardSetId_cardNumber_parallelType_key";

-- AlterTable
ALTER TABLE "CardTemplate" DROP COLUMN "cardType",
ADD COLUMN     "cardCategory" "CardCategory" NOT NULL,
ADD COLUMN     "cardTier" "CardTier" NOT NULL;

-- AlterTable
ALTER TABLE "ChecklistCard" DROP COLUMN "cardType",
DROP COLUMN "parallelType",
DROP COLUMN "serialNumber",
DROP COLUMN "variation",
ADD COLUMN     "cardCategory" "CardCategory" NOT NULL,
ADD COLUMN     "cardTier" "CardTier" NOT NULL,
ADD COLUMN     "parallelColor" TEXT,
ADD COLUMN     "printRun" INTEGER,
ADD COLUMN     "team" TEXT,
ADD COLUMN     "variationName" TEXT;

-- DropEnum
DROP TYPE "CardType";

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCard_cardSetId_cardNumber_parallelColor_key" ON "ChecklistCard"("cardSetId", "cardNumber", "parallelColor");
