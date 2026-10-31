// app/api/admin/sets/[id]/checklist/route.ts
//
// GET  — one page of this set's checklist, optionally narrowed by search
//        (same matching as the public checklist/Add Gel search — see
//        lib/data/checklistSearch.ts). Bounded to pageSize rows regardless
//        of how large the set is.
// POST — adds a single new ChecklistCard row to this set. Used for
// corrections after import (a missing row the original spreadsheet left
// out), not bulk import — see prisma/import-checklist.ts for that.
// Optionally accepts a `position` instruction to place the new row above
// or below another card instead of always landing at the end.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  parseChecklistCardInput,
  parsePositionInstruction,
  repositionChecklistCard,
  getAdminChecklistCardsPage,
  shapeAdminChecklistCard,
  adminChecklistCardSelect,
  syncTotalCardsInSet,
} from "@/lib/data/adminChecklist";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId } = await params;
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const size   = Math.min(100, Math.max(1, parseInt(searchParams.get("size") ?? "50")));
  const search = searchParams.get("search") ?? "";

  const result = await getAdminChecklistCardsPage(setId, { page, pageSize: size, search });
  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId } = await params;

  const cardSet = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true } });
  if (!cardSet) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const { data, error } = parseChecklistCardInput(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const { data: position, error: positionError } = parsePositionInstruction(body);
  if (positionError) {
    return NextResponse.json({ error: positionError }, { status: 400 });
  }

  // New rows always go at the end of the checklist's display order to
  // start with; a position instruction (if any) moves it from there.
  const maxSortOrder = await prisma.checklistCard.aggregate({
    where: { cardSetId: setId },
    _max:  { sortOrder: true },
  });

  try {
    let card = await prisma.checklistCard.create({
      data: {
        cardSetId: setId,
        ...data!,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      },
      select: adminChecklistCardSelect,
    });
    await syncTotalCardsInSet(setId);

    if (position) {
      const { error: repositionError } = await repositionChecklistCard(setId, card.id, position);
      if (repositionError) {
        return NextResponse.json({ error: repositionError }, { status: 400 });
      }
      // sortOrder on `card` above is stale after a reposition — re-fetch
      // just this one row for an accurate response.
      card = await prisma.checklistCard.findUniqueOrThrow({
        where:  { id: card.id },
        select: adminChecklistCardSelect,
      });
    }

    revalidateSetDetailCache(setId);

    return NextResponse.json({ card: shapeAdminChecklistCard(card) });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json(
        { error: "A card with this card number and parallel already exists in this set" },
        { status: 409 }
      );
    }
    throw e;
  }
}
