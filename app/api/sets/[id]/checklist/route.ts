// app/api/sets/[id]/checklist/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/app/api/auth/[...nextauth]/route";
import { prisma }                    from "@/lib/prisma";
import { Prisma, CardCategory, CardTier } from "@prisma/client";
import { getChecklistRowExtras }     from "@/lib/data/checklistRowExtras";
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

  // Search splits on whitespace into keywords — every keyword must match
  // *somewhere* (player name, parallel, variation name, team, or print run),
  // but different keywords can each match a different field. This lets
  // "Coco Gauff Tour" find every parallel of Coco Gauff's "Tour Relic
  // Autographs" insert, and "Coco Gauff /50" find just her /50 copies.
  // Print run matches when a keyword is a bare number or "/99"-style, since
  // that's how print runs are shown throughout the UI (e.g. "Purple /99").
  //
  // Matching goes through raw SQL (rather than Prisma's `contains` filter)
  // so it can wrap both sides of the comparison in Postgres's `unaccent()`
  // — that's what lets a plain "Joao" match a checklist row named "João".
  function keywordSqlCondition(keyword: string): Prisma.Sql {
    const numeric   = keyword.replace(/^\//, "");
    const printRun  = /^\d+$/.test(numeric) ? parseInt(numeric, 10) : null;
    const pattern   = `%${keyword}%`;
    return Prisma.sql`(
      unaccent("playerName") ILIKE unaccent(${pattern})
      OR unaccent(COALESCE("parallel", '')) ILIKE unaccent(${pattern})
      OR unaccent(COALESCE("variationName", '')) ILIKE unaccent(${pattern})
      OR unaccent(COALESCE("team", '')) ILIKE unaccent(${pattern})
      ${printRun !== null ? Prisma.sql`OR "printRun" = ${printRun}` : Prisma.empty}
    )`;
  }

  const searchKeywords = search.split(/\s+/).filter(Boolean);

  // `null` means "no search typed" (don't filter by id at all); an array
  // (possibly empty, meaning no matches) filters the rest of the query down
  // to just those rows.
  const searchMatchedIds = searchKeywords.length > 0
    ? (
        await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`
            SELECT "id" FROM "ChecklistCard"
            WHERE "cardSetId" = ${setId}
              AND ${Prisma.join(searchKeywords.map(keywordSqlCondition), " AND ")}
          `
        )
      ).map((r) => r.id)
    : null;

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
      notes:         extras.notes,
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
