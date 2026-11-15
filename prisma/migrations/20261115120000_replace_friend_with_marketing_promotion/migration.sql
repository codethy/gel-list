-- AlterEnum
BEGIN;
CREATE TYPE "AcquisitionMethod_new" AS ENUM ('PULLED', 'BOUGHT', 'BREAKER', 'EBAY', 'MARKETING_PROMOTION', 'SOCIAL_MEDIA', 'INFLUENCER', 'OTHER');
ALTER TABLE "PortfolioCard" ALTER COLUMN "acquisitionMethod" TYPE "AcquisitionMethod_new" USING ("acquisitionMethod"::text::"AcquisitionMethod_new");
ALTER TABLE "UnverifiedHit" ALTER COLUMN "acquisitionMethod" TYPE "AcquisitionMethod_new" USING ("acquisitionMethod"::text::"AcquisitionMethod_new");
ALTER TYPE "AcquisitionMethod" RENAME TO "AcquisitionMethod_old";
ALTER TYPE "AcquisitionMethod_new" RENAME TO "AcquisitionMethod";
DROP TYPE "public"."AcquisitionMethod_old";
COMMIT;
