/*
  Warnings:

  - You are about to drop the column `parallelColor` on the `ChecklistCard` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cardSetId,cardNumber,parallel]` on the table `ChecklistCard` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChecklistCard_cardSetId_cardNumber_parallelColor_key";

-- AlterTable
ALTER TABLE "ChecklistCard" DROP COLUMN "parallelColor",
ADD COLUMN     "parallel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistCard_cardSetId_cardNumber_parallel_key" ON "ChecklistCard"("cardSetId", "cardNumber", "parallel");
