-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSightingCountry" TEXT,
ADD COLUMN     "lastSightingMethod" TEXT,
ADD COLUMN     "lastSightingMonth" INTEGER,
ADD COLUMN     "lastSightingYear" INTEGER;
