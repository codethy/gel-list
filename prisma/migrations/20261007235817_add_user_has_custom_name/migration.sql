-- Tracks whether a user has completed the required first-sign-in "pick your
-- display name" pop-up (see components/NameSetupModal.tsx). Defaults false so
-- existing users are prompted once too, the same as any brand-new user.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasCustomName" BOOLEAN NOT NULL DEFAULT false;
