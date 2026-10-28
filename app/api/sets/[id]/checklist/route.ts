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

  // ── 5. Group matching rows by cardNumber — a "page" means N distinct base
  // cards, not N raw rows. Some cards (e.g. heavily-parallelled sports/
  // entertainment sets) have dozens of ChecklistCard rows sharing one
  // cardNumber (one per parallel/color variant) — without this, a single
  // page could return thousands of rows. Only id/cardNumber/printRun are
  // selected here (cheap even across ~10k rows); the lowest-sortOrder row
  // in each group is the page's "representative" row, and the rest are
  // fetched lazily when a group is expanded — see
  // app/api/sets/[id]/checklist/variants/route.ts. totalPrintRun (the sum
  // across every variant, null treated as 0) powers the Gels column's
  // combined "owned/print run" fraction — see step 7 below.
  const idsForGrouping = await prisma.checklistCard.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select:  { id: true, cardNumber: true, printRun: true },
  });

  const groupOrder: string[] = [];
  const groupsByCardNumber = new Map<
    string,
    { representativeId: string; cardIds: string[]; variantCount: number; totalPrintRun: number }
  >();
  for (const { id, cardNumber, printRun } of idsForGrouping) {
    const existing = groupsByCardNumber.get(cardNumber);
    if (existing) {
      existing.variantCount += 1;
      existing.cardIds.push(id);
      existing.totalPrintRun += printRun ?? 0;
    } else {
      groupsByCardNumber.set(cardNumber, {
        representativeId: id,
        cardIds: [id],
        variantCount: 1,
        totalPrintRun: printRun ?? 0,
      });
      groupOrder.push(cardNumber);
    }
  }

  const total = groupOrder.length;
  const pageCardNumbers = groupOrder.slice(skip, skip + pageSize);
  const pageGroups = pageCardNumbers.map((cn) => groupsByCardNumber.get(cn)!);
  const variantCountByRepId = new Map(pageGroups.map((g) => [g.representativeId, g.variantCount] as const));
  const totalPrintRunByRepId = new Map(pageGroups.map((g) => [g.representativeId, g.totalPrintRun] as const));
  const representativeIds = pageGroups.map((g) => g.representativeId);

  // ── 6. Combined gels-logged count across every variant in each of this
  // page's groups (e.g. a gel logged against the Red Crystalline parallel
  // still counts toward its base card's total, not just that one row's).
  const allPageVariantIds = pageGroups.flatMap((g) => g.cardIds);
  const gelsCounts = await prisma.portfolioCard.groupBy({
    by:     ["checklistCardId"],
    where:  { checklistCardId: { in: allPageVariantIds } },
    _count: { _all: true },
  });
  const gelsCountByCardId = new Map(gelsCounts.map((g) => [g.checklistCardId, g._count._all]));
  const totalGelsPulledByRepId = new Map(
    pageGroups.map((g) => [
      g.representativeId,
      g.cardIds.reduce((sum, id) => sum + (gelsCountByCardId.get(id) ?? 0), 0),
    ] as const)
  );

  // ── 7. Fetch full rows for just this page's representative cards ────────
  const cards = await prisma.checklistCard.findMany({
    where:  { id: { in: representativeIds } },
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
  const cardsById = new Map(cards.map((c) => [c.id, c]));

  // ── 8. Fetch real likes + ownership history for this page of rows ────────
  const extrasByCard = await getChecklistRowExtras(representativeIds, userId);

  // ── 9. Shape rows, preserving pagination order ───────────────────────────
  const rows = representativeIds.map((id) => {
    const c      = cardsById.get(id)!;
    const extras = extrasByCard.get(id)!;
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
      // The Gels column shows combined totals across every parallel/variant
      // of this base card, not just this one representative row — e.g. a
      // card with a /50, /25, /10, and /1 parallel shows "owned/86", and a
      // gel logged against any one of them counts toward that total. A
      // printRun of 0 only happens when every variant's own printRun is
      // null (unlimited/unspecified), so it's reported back as null too.
      printRun:      totalPrintRunByRepId.get(id) || null,
      variationName: c.variationName ?? null,
      status:        extras.status,
      ownedGelId:    extras.ownedGelId,
      likeCount:     extras.likeCount,
      isLikedByUser: extras.isLikedByUser,
      gelsPulled:    totalGelsPulledByRepId.get(id) ?? extras.gelsPulled,
      // Admin-only note (ChecklistCard.notes) — a logged gel's own note
      // only ever appears in that gel's Card History now, not here.
      notes:         c.notes ?? null,
      cardHistory:   extras.cardHistory,
      loggedGels:    extras.loggedGels,
      // > 1 means other ChecklistCard rows share this cardNumber (parallels/
      // variants) — the UI shows an expand affordance and lazy-fetches them.
      variantCount:  variantCountByRepId.get(id) ?? 1,
    };
  });

  // ── 10. Return response ────────────────────────────────────────────────────
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
