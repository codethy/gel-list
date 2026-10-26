// app/api/sets/[id]/checklist/search/route.ts
//
// Lightweight card search for the Add Gel modal — just enough fields to
// populate a ChecklistCardOption (see AddGelModal.tsx), ordered the same
// way the checklist table is (by card number / sortOrder). Deliberately
// separate from GET /api/sets/[id]/checklist, which also computes likes,
// ownership history, and per-row images for the full table — none of
// which this search dropdown needs, and all of which would make every
// keystroke far more expensive than it has to be.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMatchingChecklistCardIds } from "@/lib/data/checklistSearch";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT      = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params;
  const { searchParams } = new URL(req.url);

  const q           = searchParams.get("q")?.trim() ?? "";
  const limitParam  = Number(searchParams.get("limit"));
  const limit       = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const matchedIds = await findMatchingChecklistCardIds(setId, q);

  const cards = await prisma.checklistCard.findMany({
    where: {
      cardSetId: setId,
      ...(matchedIds !== null ? { id: { in: matchedIds } } : {}),
    },
    orderBy: { sortOrder: "asc" }, // same order as the checklist table itself
    take: limit,
    select: {
      id:            true,
      cardNumber:    true,
      playerName:    true,
      team:          true,
      cardCategory:  true,
      parallel:      true,
      printRun:      true,
      variationName: true,
    },
  });

  const options = cards.map((c) => ({
    id:            c.id,
    cardNumber:    c.cardNumber ?? "",
    playerName:    c.playerName,
    cardType:      String(c.cardCategory),
    parallelType:  c.parallel ?? null,
    printRun:      c.printRun ?? null,
    variationName: c.variationName ?? null,
    team:          c.team ?? null,
  }));

  return NextResponse.json({ options });
}
