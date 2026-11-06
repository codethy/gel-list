// app/api/sets/[id]/your-gels-pins/route.ts
//
// PUT — replaces the signed-in user's entire "Your Gels" display
// selection for this set in one shot (add/remove/reorder in
// components/set-detail/ManageYourGelsModal.tsx all funnel through here,
// rather than three separate endpoints like Favorite Gels uses — simpler
// given the modal always has the full intended list on hand already).
//
// Body: { orderedPortfolioCardIds: string[] } — 0 to YOUR_GELS_DISPLAY_LIMIT
// ids, every one of which must be one of the signed-in user's own in-hand
// gels in this exact set. An empty array clears the selection, which
// falls back to showing the most recent YOUR_GELS_DISPLAY_LIMIT gels
// (see lib/data/sets.ts's yourGelsPinnedIds).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { YOUR_GELS_DISPLAY_LIMIT } from "@/lib/data/sets";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id: setId } = await params;

  const body = await req.json().catch(() => null);
  const orderedIds = body?.orderedPortfolioCardIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedPortfolioCardIds must be an array of strings" }, { status: 400 });
  }
  if (orderedIds.length > YOUR_GELS_DISPLAY_LIMIT) {
    return NextResponse.json(
      { error: `You can only pick up to ${YOUR_GELS_DISPLAY_LIMIT} gels` },
      { status: 400 }
    );
  }

  if (orderedIds.length > 0) {
    // Ownership check — only the user's own, actually-owned gels in THIS
    // set are valid picks. A duplicate id in the request also fails this
    // (the Set below collapses it, so the count stops matching).
    const owned = await prisma.portfolioCard.findMany({
      where:  { id: { in: orderedIds }, userId, cardSetId: setId, isInHand: true },
      select: { id: true },
    });
    if (new Set(owned.map((g) => g.id)).size !== orderedIds.length) {
      return NextResponse.json({ error: "One or more gels are not yours" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.yourGelsPin.deleteMany({ where: { userId, cardSetId: setId } }),
    ...orderedIds.map((portfolioCardId: string, index: number) =>
      prisma.yourGelsPin.create({
        data: { userId, cardSetId: setId, portfolioCardId, order: index },
      })
    ),
  ]);

  return NextResponse.json({ pinnedIds: orderedIds });
}
