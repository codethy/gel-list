-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CO_OWNERSHIP_REQUEST', 'CO_OWNERSHIP_DENIED');

-- AlterEnum
ALTER TYPE "DuplicateFileDecision" ADD VALUE 'CO_OWN_AWAITING_OWNER';
ALTER TYPE "DuplicateFileDecision" ADD VALUE 'CO_OWN_CONFIRMED';
ALTER TYPE "DuplicateFileDecision" ADD VALUE 'CO_OWN_DENIED';
ALTER TYPE "DuplicateFileDecision" ADD VALUE 'CO_OWN_UNSURE';

-- AlterEnum
ALTER TYPE "DuplicateFileType" ADD VALUE 'CO_OWNERSHIP';

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "duplicateGelFileId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_duplicateGelFileId_fkey" FOREIGN KEY ("duplicateGelFileId") REFERENCES "DuplicateGelFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
