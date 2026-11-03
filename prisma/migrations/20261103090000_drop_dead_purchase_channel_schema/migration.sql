-- AlterTable
ALTER TABLE "PortfolioCard" DROP COLUMN "breakerOther",
DROP COLUMN "breakerPlatform",
DROP COLUMN "localStore",
DROP COLUMN "localStoreOther",
DROP COLUMN "purchaseChannel",
DROP COLUMN "purchaseChannelOther";

-- DropEnum
DROP TYPE "BreakerPlatform";

-- DropEnum
DROP TYPE "LocalStore";

-- DropEnum
DROP TYPE "PurchaseChannel";
