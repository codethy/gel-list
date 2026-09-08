// app/api/sets/[id]/checklist/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth";
import { authOptions }               from "@/app/api/auth/[...nextauth]/route";
import { prisma }                    from "@/lib/prisma";
import { Prisma, CardCategory }      from "@prisma/client";
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

  void userId; // will be used once ChecklistCard gains user relations

  // ── 2. Await params (required in Next.js 15) ──────────────────────────────
  const { id: setId } = await params;

  // ── 3. Parse query params ─────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const search     = searchParams.get("search")?.trim() ?? "";
  const filterType = searchParams.get("type")?.trim()   ?? "";
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

  // ── 4. Build where clause ─────────────────────────────────────────────────
  const where: Prisma.ChecklistCardWhereInput = {
    cardSetId: setId,
    ...(search ? {
      playerName: { contains: search, mode: Prisma.QueryMode.insensitive },
    } : {}),
    // ✅ FIX: filter on cardCategory (the actual field) not cardType
    ...(validatedCategory ? {
      cardCategory: validatedCategory,
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
      orderBy: [{ playerName: "asc" }, { cardCategory: "asc" }],
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
        isChase:       true,
      },
    }),
  ]);

  // ── 6. Shape rows ─────────────────────────────────────────────────────────
  const rows = cards.map((c) => ({
    id:            c.id,
    cardNumber:    c.cardNumber  ?? null,
    imageUrl:      null,
    playerName:    c.playerName,
    team:          c.team        ?? null,
    cardType:      String(c.cardCategory),  // cardCategory → cardType for UI
    parallelType:  c.parallel    ?? null,   // parallel → parallelType for UI
    printRun:      c.printRun    ?? null,
    status:        "Available" as const,
    ownedGelId:    null,
    likeCount:     0,
    isLikedByUser: false,
    notes:         null,
    cardHistory:   [],
  }));

  // ── 7. Return response ────────────────────────────────────────────────────
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
