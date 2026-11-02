// app/api/notifications/[id]/respond/route.ts
//
// POST — the original gel owner's Confirm/Deny/Unsure decision on a
// CO_OWNERSHIP_REQUEST notification (see lib/data/notifications.ts and
// the bell dropdown, components/NotificationBell.tsx). Auth-gated to
// exactly the notification's own recipient — admin has the equivalent
// (and overriding) power via CONFIRM_CO_OWNERSHIP/DENY_CO_OWNERSHIP on
// app/api/admin/duplicate-gels/[fileId]/route.ts instead.
//
// Body: { decision: "CONFIRM" | "DENY" | "UNSURE" }
//   CONFIRM — the filed (claiming) gel becomes isVerified: true,
//             duplicateFlag: NONE — shared/verified, shows normally in
//             both profiles. Counted toward AUTO_VERIFY_THRESHOLD the
//             same as a normal admin verification.
//   DENY    — the filed gel's duplicateFlag resets to NONE (falls back
//             into the normal review queue); the claimer gets a
//             CO_OWNERSHIP_DENIED notification.
//   UNSURE  — no gel changes; the file sits for the admin to decide.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import { AUTO_VERIFY_THRESHOLD } from "@/lib/data/adminGels";
import { createCoOwnershipDeniedNotification } from "@/lib/data/notifications";

const DECISIONS = new Set(["CONFIRM", "DENY", "UNSURE"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: notificationId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { decision } = body;
  if (typeof decision !== "string" || !DECISIONS.has(decision)) {
    return NextResponse.json({ error: 'decision must be "CONFIRM", "DENY", or "UNSURE"' }, { status: 400 });
  }

  const notification = await prisma.notification.findUnique({
    where:  { id: notificationId },
    select: {
      id: true,
      userId: true,
      type: true,
      duplicateGelFile: {
        select: {
          id: true,
          fileType: true,
          decision: true,
          filedGelId: true,
          filedByUserId: true,
          checklistCard: { select: { cardSetId: true } },
        },
      },
    },
  });

  if (!notification || notification.userId !== userId) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  if (notification.type !== "CO_OWNERSHIP_REQUEST" || !notification.duplicateGelFile) {
    return NextResponse.json({ error: "This notification can't be responded to" }, { status: 400 });
  }

  const file = notification.duplicateGelFile;
  if (file.fileType !== "CO_OWNERSHIP" || file.decision !== "CO_OWN_AWAITING_OWNER") {
    return NextResponse.json({ error: "This request has already been resolved" }, { status: 400 });
  }

  if (decision === "CONFIRM") {
    await prisma.duplicateGelFile.update({ where: { id: file.id }, data: { decision: "CO_OWN_CONFIRMED" } });
    if (file.filedGelId) {
      await prisma.portfolioCard.update({
        where: { id: file.filedGelId },
        data:  { isVerified: true, duplicateFlag: "NONE" },
      });
      const verifiedCount = await prisma.portfolioCard.count({
        where: { userId: file.filedByUserId, isVerified: true },
      });
      if (verifiedCount >= AUTO_VERIFY_THRESHOLD) {
        await prisma.user.updateMany({
          where: { id: file.filedByUserId, isVerifiedUser: false },
          data:  { isVerifiedUser: true },
        });
      }
    }
  } else if (decision === "DENY") {
    await prisma.duplicateGelFile.update({ where: { id: file.id }, data: { decision: "CO_OWN_DENIED" } });
    if (file.filedGelId) {
      await prisma.portfolioCard.update({
        where: { id: file.filedGelId },
        data:  { duplicateFlag: "NONE" },
      });
    }
    await createCoOwnershipDeniedNotification(file.id, file.filedByUserId);
  } else {
    // UNSURE
    await prisma.duplicateGelFile.update({ where: { id: file.id }, data: { decision: "CO_OWN_UNSURE" } });
  }

  await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });

  revalidateSetDetailCache(file.checklistCard.cardSetId);

  return NextResponse.json({ success: true });
}
