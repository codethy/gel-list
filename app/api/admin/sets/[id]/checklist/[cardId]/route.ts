// app/api/admin/sets/[id]/checklist/[cardId]/route.ts
//
// PATCH  — edits any field on one ChecklistCard row (fixing a wrong parallel,
//          a typo, etc.). The public set-detail page caches a copy of these
//          fields (see lib/data/sets.ts), so this route calls
//          revalidateSetDetailCache after writing to keep that in sync.
// DELETE — removes one ChecklistCard row, but only if no gel has ever been
//          logged against it. PortfolioCard (and the dormant CardTransfer /
//          UnverifiedHit tables) all have a required, non-cascading foreign
//          key to ChecklistCard, so deleting a row with gels on it would
//          orphan someone's logged collection data — refused outright
//          instead, with a pointer to resolve those gels first in
//          /admin/gels.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  parseChecklistCardInput,
  parsePositionInstruction,
  repositionChecklistCard,
  shapeAdminChecklistCard,
  adminChecklistCardSelect,
  syncTotalCardsInSet,
  countChecklistCardReferences,
} from "@/lib/data/adminChecklist";
import { revalidateSetDetailCache } from "@/lib/data/sets";

async function requireCardInSet(setId: string, cardId: string) {
  const card = await prisma.checklistCard.findUnique({
    where:  { id: cardId },
    select: { cardSetId: true },
  });
  return card && card.cardSetId === setId;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId, cardId } = await params;

  if (!(await requireCardInSet(setId, cardId))) {
    return NextResponse.json({ error: "Card not found in this set" }, { status: 404 });
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
  if (position && position.anchorCardId === cardId) {
    return NextResponse.json({ error: "Can't position a card relative to itself" }, { status: 400 });
  }

  try {
    let card = await prisma.checklistCard.update({
      where:  { id: cardId },
      data:   data!,
      select: adminChecklistCardSelect,
    });

    if (position) {
      const { error: repositionError } = await repositionChecklistCard(setId, cardId, position);
      if (repositionError) {
        return NextResponse.json({ error: repositionError }, { status: 400 });
      }
      // sortOrder on `card` above is stale after a reposition — re-fetch
      // just this one row for an accurate response.
      card = await prisma.checklistCard.findUniqueOrThrow({
        where:  { id: cardId },
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId, cardId } = await params;

  if (!(await requireCardInSet(setId, cardId))) {
    return NextResponse.json({ error: "Card not found in this set" }, { status: 404 });
  }

  const refCount = await countChecklistCardReferences(cardId);
  if (refCount > 0) {
    return NextResponse.json(
      {
        error: `${refCount} gel${refCount === 1 ? " is" : "s are"} logged against this card — resolve ${refCount === 1 ? "it" : "them"} in /admin/gels first, or edit this row instead of deleting it.`,
      },
      { status: 409 }
    );
  }

  await prisma.checklistCard.delete({ where: { id: cardId } });
  await syncTotalCardsInSet(setId);
  revalidateSetDetailCache(setId);

  return NextResponse.json({ success: true });
}
