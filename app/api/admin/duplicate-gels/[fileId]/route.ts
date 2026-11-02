// app/api/admin/duplicate-gels/[fileId]/route.ts
//
// PATCH — the developer's action on one DuplicateGelFile. Admin-only (see
// lib/admin.ts).
//
// Body: { action: "CONFIRM_DUPLICATE" | "NOT_DUPLICATE" | "APPROVE_CLAIM" | "REJECT_CLAIM" | "CLOSE" | "REOPEN" }
//   CONFIRM_DUPLICATE — fileType DUPLICATE only. The developer confirms
//                        this is a real duplicate (e.g. a genuine
//                        manufacturer misprint of the same serial twice).
//                        Both gels still referenced by the file get
//                        duplicateFlag: VERIFIED_DUPLICATE — overriding
//                        their badge everywhere they're shown.
//   NOT_DUPLICATE      — fileType DUPLICATE only. The developer disagrees
//                        (one side made a mistake, handled via the normal
//                        edit/verify flow instead). Both gels'
//                        duplicateFlag resets to NONE, dropping them back
//                        into the normal review flow.
//   APPROVE_CLAIM      — fileType CLAIM only. The developer confirms the
//                        claiming user really does own this card: the
//                        filed (claiming) gel becomes isVerified: true,
//                        duplicateFlag: NONE — counted toward
//                        AUTO_VERIFY_THRESHOLD the same as a normal
//                        verification. The existing (originally reported)
//                        gel only has its duplicateFlag reset to NONE —
//                        its own isVerified is untouched, it's a separate
//                        gel's own history.
//   REJECT_CLAIM       — fileType CLAIM only. The developer disagrees —
//                        both gels' duplicateFlag resets to NONE; the
//                        claiming gel falls back into the normal
//                        isVerified-driven review queue (the admin can
//                        still remove it outright via the file's own
//                        per-gel "Remove" button if it should be deleted).
//   CLOSE / REOPEN     — pure housekeeping, independent of the decision
//                        above — a file can be closed in any decision
//                        state and reopened later.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import { AUTO_VERIFY_THRESHOLD } from "@/lib/data/adminGels";

const ACTIONS = new Set(["CONFIRM_DUPLICATE", "NOT_DUPLICATE", "APPROVE_CLAIM", "REJECT_CLAIM", "CLOSE", "REOPEN"]);
const DUPLICATE_ACTIONS = new Set(["CONFIRM_DUPLICATE", "NOT_DUPLICATE"]);
const CLAIM_ACTIONS = new Set(["APPROVE_CLAIM", "REJECT_CLAIM"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;
  if (typeof action !== "string" || !ACTIONS.has(action)) {
    return NextResponse.json(
      { error: 'action must be one of "CONFIRM_DUPLICATE", "NOT_DUPLICATE", "APPROVE_CLAIM", "REJECT_CLAIM", "CLOSE", "REOPEN"' },
      { status: 400 }
    );
  }

  const file = await prisma.duplicateGelFile.findUnique({
    where:  { id: fileId },
    select: {
      id:            true,
      fileType:      true,
      filedGelId:    true,
      existingGelId: true,
      filedGel:      { select: { userId: true } },
      checklistCard: { select: { cardSetId: true } },
    },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (DUPLICATE_ACTIONS.has(action) && file.fileType !== "DUPLICATE") {
    return NextResponse.json({ error: `${action} only applies to a duplicate-type file` }, { status: 400 });
  }
  if (CLAIM_ACTIONS.has(action) && file.fileType !== "CLAIM") {
    return NextResponse.json({ error: `${action} only applies to a claim-type file` }, { status: 400 });
  }

  const gelIds = [file.filedGelId, file.existingGelId].filter((id): id is string => id !== null);

  if (action === "CONFIRM_DUPLICATE" || action === "NOT_DUPLICATE") {
    const decision = action === "CONFIRM_DUPLICATE" ? "CONFIRMED_DUPLICATE" : "NOT_DUPLICATE";
    const duplicateFlag = action === "CONFIRM_DUPLICATE" ? "VERIFIED_DUPLICATE" : "NONE";

    await prisma.$transaction([
      prisma.duplicateGelFile.update({ where: { id: fileId }, data: { decision } }),
      ...(gelIds.length > 0
        ? [prisma.portfolioCard.updateMany({ where: { id: { in: gelIds } }, data: { duplicateFlag } })]
        : []),
    ]);
  } else if (action === "APPROVE_CLAIM" || action === "REJECT_CLAIM") {
    const decision = action === "APPROVE_CLAIM" ? "CLAIM_APPROVED" : "CLAIM_REJECTED";

    await prisma.duplicateGelFile.update({ where: { id: fileId }, data: { decision } });
    if (file.existingGelId) {
      await prisma.portfolioCard.update({
        where: { id: file.existingGelId },
        data:  { duplicateFlag: "NONE" },
      });
    }
    if (file.filedGelId) {
      await prisma.portfolioCard.update({
        where: { id: file.filedGelId },
        data:  action === "APPROVE_CLAIM"
          ? { duplicateFlag: "NONE", isVerified: true }
          : { duplicateFlag: "NONE" },
      });

      // Approving a claim counts toward AUTO_VERIFY_THRESHOLD the same
      // way a normal /admin/gels verification does.
      if (action === "APPROVE_CLAIM" && file.filedGel) {
        const verifiedCount = await prisma.portfolioCard.count({
          where: { userId: file.filedGel.userId, isVerified: true },
        });
        if (verifiedCount >= AUTO_VERIFY_THRESHOLD) {
          await prisma.user.updateMany({
            where: { id: file.filedGel.userId, isVerifiedUser: false },
            data:  { isVerifiedUser: true },
          });
        }
      }
    }
  } else {
    // CLOSE / REOPEN
    await prisma.duplicateGelFile.update({
      where: { id: fileId },
      data:  { status: action === "CLOSE" ? "CLOSED" : "OPEN" },
    });
  }

  revalidateSetDetailCache(file.checklistCard.cardSetId);

  return NextResponse.json({ success: true });
}
