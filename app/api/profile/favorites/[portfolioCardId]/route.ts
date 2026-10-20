// app/api/profile/favorites/[portfolioCardId]/route.ts
//
// DELETE — removes one gel from the signed-in user's Favorite Gels. Leaves
// gaps in the remaining `order` values rather than compacting them — every
// read already sorts by order ascending, so gaps are harmless.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getFavoriteGels } from "@/lib/data/profile";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ portfolioCardId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;
  const { portfolioCardId } = await params;

  await prisma.favoriteGel.deleteMany({ where: { userId, portfolioCardId } });

  return NextResponse.json({ favorites: await getFavoriteGels(userId) });
}
