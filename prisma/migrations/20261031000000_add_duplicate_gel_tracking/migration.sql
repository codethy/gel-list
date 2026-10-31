-- CreateEnum
CREATE TYPE "DuplicateFlag" AS ENUM ('NONE', 'PENDING', 'VERIFIED_DUPLICATE');

-- CreateEnum
CREATE TYPE "DuplicateFileStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DuplicateFileDecision" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE');

-- AlterTable
ALTER TABLE "PortfolioCard" DROP COLUMN "isDuplicate",
ADD COLUMN     "duplicateFlag" "DuplicateFlag" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "DuplicateGelFile" (
    "id" TEXT NOT NULL,
    "fileNumber" SERIAL NOT NULL,
    "checklistCardId" TEXT NOT NULL,
    "filedByUserId" TEXT NOT NULL,
    "filedGelId" TEXT,
    "existingGelId" TEXT,
    "status" "DuplicateFileStatus" NOT NULL DEFAULT 'OPEN',
    "decision" "DuplicateFileDecision" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuplicateGelFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateGelFile_fileNumber_key" ON "DuplicateGelFile"("fileNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateGelFile_filedGelId_key" ON "DuplicateGelFile"("filedGelId");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateGelFile_existingGelId_key" ON "DuplicateGelFile"("existingGelId");

-- AddForeignKey
ALTER TABLE "DuplicateGelFile" ADD CONSTRAINT "DuplicateGelFile_checklistCardId_fkey" FOREIGN KEY ("checklistCardId") REFERENCES "ChecklistCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateGelFile" ADD CONSTRAINT "DuplicateGelFile_filedByUserId_fkey" FOREIGN KEY ("filedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateGelFile" ADD CONSTRAINT "DuplicateGelFile_filedGelId_fkey" FOREIGN KEY ("filedGelId") REFERENCES "PortfolioCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateGelFile" ADD CONSTRAINT "DuplicateGelFile_existingGelId_fkey" FOREIGN KEY ("existingGelId") REFERENCES "PortfolioCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
