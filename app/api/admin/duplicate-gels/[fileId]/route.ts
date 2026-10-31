// app/api/admin/duplicate-gels/[fileId]/route.ts
//
// PATCH — the developer's action on one DuplicateGelFile. Admin-only (see
// lib/admin.ts).
//
// Body: { action: "CONFIRM_DUPLICATE" | "NOT_DUPLICATE" | "CLOSE" | "REOPEN" }
//   CONFIRM_DUPLICATE — the developer confirms this is a real duplicate
//                        (e.g. a genuine manufacturer misprint of the same
//                        serial twice). Both gels still referenced by the
//                        file get duplicateFlag: VERIFIED_DUPLICATE —
//                        overriding their badge everywhere they're shown.
//   NOT_DUPLICATE      — the developer disagrees (one side made a mistake,
//                        handled via the normal edit/verify flow instead).
//                        Both gels' duplicateFlag resets to NONE, dropping
//                        them back into the normal review flow.
//   CLOSE / REOPEN     — pure housekeeping, independent of the decision
//                        above — a file can be closed in any decision
//                        state and reopened later.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";

const ACTIONS = new Set(["CONFIRM_DUPLICATE", "NOT_DUPLICATE", "CLOSE", "REOPEN"]);

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
      { error: 'action must be one of "CONFIRM_DUPLICATE", "NOT_DUPLICATE", "CLOSE", "REOPEN"' },
      { status: 400 }
    );
  }

  const file = await prisma.duplicateGelFile.findUnique({
    where:  { id: fileId },
    select: { id: true, filedGelId: true, existingGelId: true, checklistCard: { select: { cardSetId: true } } },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
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
