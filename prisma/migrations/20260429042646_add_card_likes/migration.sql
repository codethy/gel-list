-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SPORTS', 'TCG', 'ENTERTAINMENT');

-- CreateEnum
CREATE TYPE "SportSubCategory" AS ENUM ('SOCCER', 'BASKETBALL', 'BASEBALL', 'FOOTBALL', 'TENNIS', 'RACING', 'HOCKEY', 'GOLF', 'UFC_MMA', 'OTHER');

-- CreateEnum
CREATE TYPE "TcgSubCategory" AS ENUM ('POKEMON', 'ONE_PIECE', 'MAGIC_THE_GATHERING', 'YU_GI_OH', 'LORCANA', 'RIFTBOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "EntertainmentSubCategory" AS ENUM ('DISNEY', 'MARVEL', 'STAR_WARS', 'DC', 'HARRY_POTTER', 'FORTNITE', 'OTHER');

-- CreateEnum
CREATE TYPE "AcquisitionMethod" AS ENUM ('PULLED', 'BOUGHT');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('BASE_PARALLEL', 'NUMBERED_PARALLEL', 'BASE_AUTO', 'NUMBERED_AUTO', 'BASE_RELIC', 'NUMBERED_RELIC', 'BASE_INSERT', 'NUMBERED_INSERT', 'RARE', 'DOUBLE_RARE', 'ULTRA_RARE', 'ILLUSTRATION_RARE', 'SPECIAL_ILLUSTRATION_RARE', 'HYPER_RARE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HOBBY_BOX', 'BLASTER_BOX', 'HANGER_BOX', 'BOOSTER_PACK', 'CASE', 'ETB', 'BOOSTER_BUNDLE', 'UPC', 'SPC', 'BOOSTER_BOX', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseChannel" AS ENUM ('OFFICIAL_WEBSITE', 'EBAY', 'LOCAL_STORE', 'BREAKERS', 'OTHER');

-- CreateEnum
CREATE TYPE "LocalStore" AS ENUM ('WALMART', 'TARGET', 'COSTCO', 'BESTBUY', 'OTHER');

-- CreateEnum
CREATE TYPE "BreakerPlatform" AS ENUM ('WHATNOT', 'FANATICS', 'EBAY_LIVE', 'OTHER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "username" TEXT,
    "profileImage" TEXT,
    "usernameLastChanged" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "subCategory" TEXT NOT NULL,
    "totalCardsInSet" INTEGER NOT NULL DEFAULT 0,
    "totalHitsInSet" INTEGER NOT NULL DEFAULT 0,
    "totalChaseCardsInSet" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "parallelType" TEXT,
    "cardType" "CardType" NOT NULL,
    "printRun" INTEGER,
    "imageUrl" TEXT,
    "team" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardTemplateId" TEXT NOT NULL,
    "cardSetId" TEXT NOT NULL,
    "ripSessionId" TEXT,
    "isHit" BOOLEAN NOT NULL DEFAULT false,
    "isInHand" BOOLEAN NOT NULL DEFAULT true,
    "acquisitionMethod" "AcquisitionMethod",
    "hitCountry" TEXT,
    "hitCity" TEXT,
    "hitMonth" INTEGER,
    "hitYear" INTEGER,
    "seller" VARCHAR(255),
    "productType" "ProductType",
    "productTypeOther" VARCHAR(150),
    "totalCardsInProduct" INTEGER,
    "productQuantityOpened" INTEGER,
    "purchaseChannel" "PurchaseChannel",
    "localStore" "LocalStore",
    "localStoreOther" VARCHAR(150),
    "breakerPlatform" "BreakerPlatform",
    "breakerOther" VARCHAR(150),
    "purchaseChannelOther" VARCHAR(150),
    "serialNumber" INTEGER,
    "cardFrontImageUrl" TEXT,
    "cardBackImageUrl" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RipSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardSetId" TEXT,
    "productType" "ProductType" NOT NULL,
    "productTypeOther" VARCHAR(150),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCardsFromSession" INTEGER NOT NULL DEFAULT 0,
    "totalHitsFromSession" INTEGER NOT NULL DEFAULT 0,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RipSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnverifiedHit" (
    "id" TEXT NOT NULL,
    "cardTemplateId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "sightings" TEXT NOT NULL,
    "reportedUsername" TEXT,
    "sourceUrl" TEXT,
    "acquisitionMethod" "AcquisitionMethod",
    "seller" VARCHAR(255),
    "hitCountry" TEXT,
    "hitCity" TEXT,
    "hitMonth" INTEGER,
    "hitYear" INTEGER,
    "productType" "ProductType",
    "cardFrontImageUrl" TEXT,
    "cardBackImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnverifiedHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTransfer" (
    "id" TEXT NOT NULL,
    "cardTemplateId" TEXT NOT NULL,
    "portfolioCardId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "transferDate" TIMESTAMP(3),
    "transferMethod" VARCHAR(100),
    "salePrice" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTemplateLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardTemplateLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplate_cardSetId_cardNumber_parallelType_key" ON "CardTemplate"("cardSetId", "cardNumber", "parallelType");

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplateLike_userId_cardTemplateId_key" ON "CardTemplateLike"("userId", "cardTemplateId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_cardTemplateId_fkey" FOREIGN KEY ("cardTemplateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCard" ADD CONSTRAINT "PortfolioCard_ripSessionId_fkey" FOREIGN KEY ("ripSessionId") REFERENCES "RipSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RipSession" ADD CONSTRAINT "RipSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RipSession" ADD CONSTRAINT "RipSession_cardSetId_fkey" FOREIGN KEY ("cardSetId") REFERENCES "CardSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnverifiedHit" ADD CONSTRAINT "UnverifiedHit_cardTemplateId_fkey" FOREIGN KEY ("cardTemplateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnverifiedHit" ADD CONSTRAINT "UnverifiedHit_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransfer" ADD CONSTRAINT "CardTransfer_cardTemplateId_fkey" FOREIGN KEY ("cardTemplateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransfer" ADD CONSTRAINT "CardTransfer_portfolioCardId_fkey" FOREIGN KEY ("portfolioCardId") REFERENCES "PortfolioCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransfer" ADD CONSTRAINT "CardTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTransfer" ADD CONSTRAINT "CardTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplateLike" ADD CONSTRAINT "CardTemplateLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplateLike" ADD CONSTRAINT "CardTemplateLike_cardTemplateId_fkey" FOREIGN KEY ("cardTemplateId") REFERENCES "CardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
