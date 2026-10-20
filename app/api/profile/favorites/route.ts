// app/api/profile/favorites/route.ts
//
// POST — adds one of the signed-in user's own gels to their Favorite Gels
// (max 6, see MAX_FAVORITE_GELS). Returns the full, freshly-ordered list.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getFavoriteGels, MAX_FAVORITE_GELS } from "@/lib/data/profile";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const portfolioCardId = body?.portfolioCardId;
  if (typeof portfolioCardId !== "string" || !portfolioCardId) {
    return NextResponse.json({ error: "portfolioCardId is required" }, { status: 400 });
  }

  // Only the user's own, actually-owned gels can be favorited.
  const gel = await prisma.portfolioCard.findFirst({
    where:  { id: portfolioCardId, userId, isInHand: true },
    select: { id: true },
  });
  if (!gel) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

  const currentCount = await prisma.favoriteGel.count({ where: { userId } });
  if (currentCount >= MAX_FAVORITE_GELS) {
    return NextResponse.json(
      { error: `You can only pick up to ${MAX_FAVORITE_GELS} favorite gels` },
      { status: 400 }
    );
  }

  try {
    await prisma.favoriteGel.create({
      data: { userId, portfolioCardId, order: currentCount },
    });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Already in your favorites" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ favorites: await getFavoriteGels(userId) });
}
