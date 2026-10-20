// app/api/profile/favorites/reorder/route.ts
//
// PATCH — sets the display order of the signed-in user's Favorite Gels to
// match the given sequence. Body: { orderedPortfolioCardIds: string[] }.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getFavoriteGels } from "@/lib/data/profile";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const orderedIds = body?.orderedPortfolioCardIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedPortfolioCardIds must be an array of strings" }, { status: 400 });
  }

  // Only ever reorder among the user's own existing favorites — a ownership
  // check, not just type validation.
  const existing = await prisma.favoriteGel.findMany({
    where:  { userId, portfolioCardId: { in: orderedIds } },
    select: { portfolioCardId: true },
  });
  const existingIds = new Set(existing.map((f) => f.portfolioCardId));
  const toReorder = orderedIds.filter((id: string) => existingIds.has(id));

  await prisma.$transaction(
    toReorder.map((portfolioCardId: string, index: number) =>
      prisma.favoriteGel.update({
        where:  { userId_portfolioCardId: { userId, portfolioCardId } },
        data:   { order: index },
      })
    )
  );

  return NextResponse.json({ favorites: await getFavoriteGels(userId) });
}
