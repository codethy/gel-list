/*
  Warnings:

  - The values [COMMON,UNCOMMON,RARE,DOUBLE_RARE,ULTRA_RARE,ILLUSTRATION_RARE,SPECIAL_ILLUSTRATION_RARE,HYPER_RARE,MEGA_HYPER_RARE,ACE_SPEC_RARE,SHINY_RARE,SHINY_ULTRA_RARE,SUPER_RARE,LEGENDARY,EPIC,ENCHANTED,ICONIC,OVERNUMBERED,MYTHIC,SECRET_RARE,LEADER,SPECIAL,ULTIMATE_RARE,GHOST_RARE] on the enum `CardCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [SHORT_PRINT,SUPER_SHORT_PRINT] on the enum `CardTier` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CardCategory_new" AS ENUM ('BASE', 'PARALLEL', 'INSERT', 'AUTO', 'RELIC', 'AUTO_RELIC', 'PATCH_AUTO', 'FACSIMILE_AUTO', 'DUAL_AUTO', 'TRIPLE_AUTO', 'QUAD_AUTO', 'BOOKLET', 'ON_CARD_AUTO', 'IMAGE_VARIATION', 'SKETCH_ART', 'SHORT_PRINT', 'SUPER_SHORT_PRINT', 'CASE_HIT', 'PROMO', 'REGULAR', 'HOLO', 'REVERSE_HOLO', 'SHADOWLESS', 'COLD_FOIL', 'HOLO_FOIL', 'FULL_ART', 'ALT_ART', 'OTHER_FOIL', 'TCG_PROMO');
ALTER TABLE "CardTemplate" ALTER COLUMN "cardCategory" TYPE "CardCategory_new" USING ("cardCategory"::text::"CardCategory_new");
ALTER TABLE "ChecklistCard" ALTER COLUMN "cardCategory" TYPE "CardCategory_new" USING ("cardCategory"::text::"CardCategory_new");
ALTER TYPE "CardCategory" RENAME TO "CardCategory_old";
ALTER TYPE "CardCategory_new" RENAME TO "CardCategory";
DROP TYPE "public"."CardCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CardTier_new" AS ENUM ('UNLIMITED', 'LIMITED', 'NUMBERED', 'ONE_OF_ONE', 'SP', 'SSP', 'CASE_HIT', 'COMMON', 'UNCOMMON', 'RARE', 'RR', 'SR', 'AR', 'SAR', 'UR', 'MUR', 'ACE', 'SHR', 'SSR', 'SUPER_RARE', 'LEGENDARY', 'EPIC', 'ENCHANTED', 'ICONIC', 'ALT_ART', 'OVER', 'OVER_SIGN', 'MYTHIC', 'C_ALT', 'UC_ALT', 'R_ALT', 'SR_ALT', 'SR_MANGA', 'SEC', 'SEC_ALT', 'LEADER', 'L_ALT', 'SPECIAL_RARE', 'MANGA', 'GOLD_MANGA', 'TR', 'DON', 'GOLD_DON', 'ULTIMATE_RARE', 'GHOST_RARE', 'PROMO');
ALTER TABLE "CardTemplate" ALTER COLUMN "cardTier" TYPE "CardTier_new" USING ("cardTier"::text::"CardTier_new");
ALTER TABLE "ChecklistCard" ALTER COLUMN "cardTier" TYPE "CardTier_new" USING ("cardTier"::text::"CardTier_new");
ALTER TYPE "CardTier" RENAME TO "CardTier_old";
ALTER TYPE "CardTier_new" RENAME TO "CardTier";
DROP TYPE "public"."CardTier_old";
COMMIT;
