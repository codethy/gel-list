-- CreateEnum
CREATE TYPE "DuplicateFileType" AS ENUM ('DUPLICATE', 'CLAIM');

-- AlterEnum
ALTER TYPE "DuplicateFileDecision" ADD VALUE 'CLAIM_APPROVED';
ALTER TYPE "DuplicateFileDecision" ADD VALUE 'CLAIM_REJECTED';

-- AlterEnum
ALTER TYPE "DuplicateFlag" ADD VALUE 'CLAIMING';

-- AlterTable
ALTER TABLE "DuplicateGelFile" ADD COLUMN     "fileType" "DuplicateFileType" NOT NULL DEFAULT 'DUPLICATE';
