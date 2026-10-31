// app/api/sets/[id]/cards/[templateId]/like/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";

// ─── POST /api/sets/[id]/cards/[templateId]/like ──────────────────────────────
// Toggles a like on a checklist card for the current user.
// "templateId" here is a ChecklistCard id — the route folder name is a
// leftover from the removed CardTemplate model, kept as-is since renaming it
// would change the URL path for no functional benefit.
// Returns: { liked: boolean, likeCount: number }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  // ── 1. Auth guard ───────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── 2. Resolve user ─────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Next.js 15 requires awaiting params before reading any property off it.
  const { id: setId, templateId } = await params;

  // ── 3. Confirm the checklist card belongs to this set ────────────────────
  const checklistCard = await prisma.checklistCard.findFirst({
    where: { id: templateId, cardSetId: setId },
    select: { id: true },
  });
  if (!checklistCard) {
    return NextResponse.json({ error: "Card not found in this set" }, { status: 404 });
  }

  // ── 4. Toggle like ──────────────────────────────────────────────────────
  const existing = await prisma.checklistCardLike.findUnique({
    where: {
      userId_checklistCardId: {
        userId: user.id,
        checklistCardId: templateId,
      },
    },
  });

  if (existing) {
    // Unlike
    await prisma.checklistCardLike.delete({
      where: { id: existing.id },
    });
  } else {
    // Like
    await prisma.checklistCardLike.create({
      data: {
        userId: user.id,
        checklistCardId: templateId,
      },
    });
  }

  // ── 5. Return fresh count ───────────────────────────────────────────────
  const likeCount = await prisma.checklistCardLike.count({
    where: { checklistCardId: templateId },
  });

  // likeCount is part of the cached global checklist-row payload.
  revalidateSetDetailCache(setId);

  return NextResponse.json({
    liked: !existing,
    likeCount,
  });
}
