// app/api/sets/[id]/cards/[templateId]/like/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// ─── POST /api/sets/[id]/cards/[templateId]/like ──────────────────────────────
// Toggles a like on a card template for the current user.
// Returns: { liked: boolean, likeCount: number }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; templateId: string } }
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

  const { id: setId, templateId } = params;

  // ── 3. Confirm template belongs to this set ─────────────────────────────
  const template = await prisma.cardTemplate.findFirst({
    where: { id: templateId, cardSetId: setId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Card not found in this set" }, { status: 404 });
  }

  // ── 4. Toggle like ──────────────────────────────────────────────────────
  const existing = await prisma.cardTemplateLike.findUnique({
    where: {
      userId_cardTemplateId: {
        userId: user.id,
        cardTemplateId: templateId,
      },
    },
  });

  if (existing) {
    // Unlike
    await prisma.cardTemplateLike.delete({
      where: { id: existing.id },
    });
  } else {
    // Like
    await prisma.cardTemplateLike.create({
      data: {
        userId: user.id,
        cardTemplateId: templateId,
      },
    });
  }

  // ── 5. Return fresh count ───────────────────────────────────────────────
  const likeCount = await prisma.cardTemplateLike.count({
    where: { cardTemplateId: templateId },
  });

  return NextResponse.json({
    liked: !existing,
    likeCount,
  });
}
