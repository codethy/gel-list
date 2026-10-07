-- Adds the gel verification workflow: every logged gel starts unverified
-- and is reviewed by the developer at /admin/gels; a user who's had 5 gels
-- verified becomes "trusted" and their future gels auto-verify.
ALTER TABLE "PortfolioCard" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerifiedUser" BOOLEAN NOT NULL DEFAULT false;
