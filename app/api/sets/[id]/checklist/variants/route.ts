// app/api/sets/[id]/checklist/variants/route.ts
//
// Lazy-loaded sibling rows for one "grouped" checklist row — every
// ChecklistCard sharing the clicked row's cardNumber (its parallels/
// variants), fetched only when that row is expanded. See the grouping
// logic in app/api/sets/[id]/checklist/route.ts for why cards are grouped
// by cardNumber in the first place (a heavily-parallelled sports/
// entertainment card can have 50+ rows sharing one cardNumber).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/app/api/auth/[...nextauth]/route";
import { prisma }                    from "@/lib/prisma";
import { getChecklistRowExtras }     from "@/lib/data/checklistRowExtras";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where:  { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const { id: setId } = await params;
  const { searchParams } = new URL(req.url);
  const cardNumber = searchParams.get("cardNumber")?.trim() ?? "";

  if (!cardNumber) {
    return NextResponse.json({ error: "cardNumber is required" }, { status: 400 });
  }

  const cards = await prisma.checklistCard.findMany({
    where:   { cardSetId: setId, cardNumber },
    orderBy: { sortOrder: "asc" },
    select: {
      id:            true,
      cardNumber:    true,
      playerName:    true,
      team:          true,
      cardCategory:  true,
      cardTier:      true,
      parallel:      true,
      printRun:      true,
      variationName: true,
      isHit:         true,
      imageUrl:      true,
      notes:         true,
    },
  });

  const cardIds      = cards.map((c) => c.id);
  const extrasByCard = await getChecklistRowExtras(cardIds, userId);

  const rows = cards.map((c) => {
    const extras = extrasByCard.get(c.id)!;
    return {
      id:                c.id,
      cardNumber:        c.cardNumber  ?? null,
      imageUrl:          extras.imageUrl ?? c.imageUrl ?? null,
      cardBackImageUrl:  extras.cardBackImageUrl,
      playerName:        c.playerName,
      team:          c.team        ?? null,
      cardType:      String(c.cardCategory),
      cardTier:      String(c.cardTier),
      parallelType:  c.parallel    ?? null,
      printRun:      c.printRun    ?? null,
      variationName: c.variationName ?? null,
      status:        extras.status,
      ownedGelId:    extras.ownedGelId,
      likeCount:     extras.likeCount,
      isLikedByUser: extras.isLikedByUser,
      gelsPulled:    extras.gelsPulled,
      notes:         c.notes ?? null,
      cardHistory:   extras.cardHistory,
      loggedGels:    extras.loggedGels,
      variantCount:  cards.length,
    };
  });

  return NextResponse.json({ rows });
}
