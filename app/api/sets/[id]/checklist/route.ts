// app/api/sets/[id]/checklist/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/app/api/auth/[...nextauth]/route";
import { prisma }                    from "@/lib/prisma";
import { Prisma, CardCategory, CardTier } from "@prisma/client";
import { getChecklistRowExtras }     from "@/lib/data/checklistRowExtras";
import { findMatchingChecklistCardIds } from "@/lib/data/checklistSearch";
// ✅ FIX: import CardCategory (not CardType — that enum doesn't exist)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where:  { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  // ── 2. Await params (required in Next.js 15) ──────────────────────────────
  const { id: setId } = await params;

  // ── 3. Parse query params ─────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const search     = searchParams.get("search")?.trim() ?? "";
  const filterType = searchParams.get("type")?.trim()   ?? "";
  const filterTier = searchParams.get("tier")?.trim()   ?? ""; // TCG sets only — see below
  const filterTeam = searchParams.get("team")?.trim()   ?? "";
  const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize   = Math.min(100, Math.max(1, parseInt(searchParams.get("size") ?? "50")));
  const skip       = (page - 1) * pageSize;

  // ✅ FIX: Validate filterType against the real CardCategory enum.
  // If the value from the URL doesn't match any CardCategory value, ignore it.
  const validCardCategories = Object.values(CardCategory);
  const validatedCategory =
    filterType && validCardCategories.includes(filterType as CardCategory)
      ? (filterType as CardCategory)
      : undefined;

  // Same validation for the TCG-only "Rarity" filter (cardTier).
  const validCardTiers = Object.values(CardTier);
  const validatedTier =
    filterTier && validCardTiers.includes(filterTier as CardTier)
      ? (filterTier as CardTier)
      : undefined;

  // `null` means "no search typed" (don't filter by id at all); an array
  // (possibly empty, meaning no matches) filters the rest of the query down
  // to just those rows. See lib/data/checklistSearch.ts for what counts as
  // a match — shared with the lightweight Add Gel modal search so the two
  // search boxes never drift apart.
  const searchMatchedIds = await findMatchingChecklistCardIds(setId, search);

  // ── 4. Build where clause ─────────────────────────────────────────────────
  const where: Prisma.ChecklistCardWhereInput = {
    cardSetId: setId,
    ...(searchMatchedIds !== null ? {
      id: { in: searchMatchedIds },
    } : {}),
    // ✅ FIX: filter on cardCategory (the actual field) not cardType
    ...(validatedCategory ? {
      cardCategory: validatedCategory,
    } : {}),
    ...(validatedTier ? {
      cardTier: validatedTier,
    } : {}),
    ...(filterTeam ? {
      team: { contains: filterTeam, mode: Prisma.QueryMode.insensitive },
    } : {}),
  };

  // ── 5. Fetch data ─────────────────────────────────────────────────────────
  const [total, cards] = await Promise.all([
    prisma.checklistCard.count({ where }),
    prisma.checklistCard.findMany({
      where,
      skip,
      take:    pageSize,
      orderBy: { sortOrder: "asc" }, // matches the source checklist file's row order
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
    }),
  ]);

  // ── 6. Fetch real likes + ownership history for this page of rows ────────
  const cardIds       = cards.map((c) => c.id);
  const extrasByCard  = await getChecklistRowExtras(cardIds, userId);

  // ── 7. Shape rows ─────────────────────────────────────────────────────────
  const rows = cards.map((c) => {
    const extras = extrasByCard.get(c.id)!;
    return {
      id:                c.id,
      cardNumber:        c.cardNumber  ?? null,
      // A real logged gel's own photo takes precedence; the admin-set
      // default image (ChecklistCard.imageUrl) only fills in until one exists.
      imageUrl:          extras.imageUrl ?? c.imageUrl ?? null,
      cardBackImageUrl:  extras.cardBackImageUrl,
      playerName:        c.playerName,
      team:          c.team        ?? null,
      cardType:      String(c.cardCategory),  // cardCategory → cardType for UI
      cardTier:      String(c.cardTier),      // only shown for TCG sets, as "Rarity"
      parallelType:  c.parallel    ?? null,   // parallel → parallelType for UI
      printRun:      c.printRun    ?? null,
      variationName: c.variationName ?? null,
      status:        extras.status,
      ownedGelId:    extras.ownedGelId,
      likeCount:     extras.likeCount,
      isLikedByUser: extras.isLikedByUser,
      gelsPulled:    extras.gelsPulled,
      // Admin-only note (ChecklistCard.notes) — a logged gel's own note
      // only ever appears in that gel's Card History now, not here.
      notes:         c.notes ?? null,
      cardHistory:   extras.cardHistory,
      loggedGels:    extras.loggedGels,
    };
  });

  // ── 8. Return response ────────────────────────────────────────────────────
  return NextResponse.json({
    rows,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
