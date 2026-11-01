// app/api/sets/[id]/gels/batch/route.ts
//
// POST — creates several PortfolioCards (gels) in one request, all sharing
// the same acquisition/product/date/location details — the "Multiple
// Gels" path in AddGelModal.tsx, for logging several cards pulled/bought
// (or surfaced from the same person) at once. The single-gel sibling at
// ../route.ts is unchanged and still used for the "Single Gel" path.
//
// Body fields:
//   loggedFor, acquisitionMethod, productType, productTypeOther, seller,
//   hitYear, hitMonth, hitCity, hitCountry — same meaning as the single
//   route, shared across every card in this batch.
//   cards — required, non-empty array of:
//     cardTemplateId     — required (see the single route's doc comment
//                          for why this wire name, not checklistCardId)
//     serialNumber       — optional number
//     cardFrontImageUrl  — required
//     cardBackImageUrl   — optional string
//     notes              — optional for "SELF", required for "OTHER"
//
// Duplicate handling is deliberately simpler than the single route: if ANY
// card in the batch collides with an existing PortfolioCard (same
// checklistCardId + serialNumber) or with another card in this same
// batch, the whole request fails atomically with a 409/400 naming the
// offending card's index — nothing is created. There's no "File a
// Duplicate" option here; a real duplicate needs the single-gel flow's
// Replace/File-a-Duplicate dialog to resolve properly.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { rememberGelLocationDefaults } from "@/lib/data/userGelDefaults";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import { findDuplicateMatch, shapeDuplicateResponse, createGelRow } from "@/lib/data/gels";

interface RawCardInput {
  cardTemplateId:    string;
  serialNumber:      number | null;
  cardFrontImageUrl: string | null;
  cardBackImageUrl:  string | null;
  notes:             string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: setId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    loggedFor,
    acquisitionMethod,
    productType,
    productTypeOther,
    seller,
    hitYear,
    hitMonth,
    hitCity,
    hitCountry,
    cards: rawCards,
  } = body;

  const isInHand = loggedFor !== "OTHER";
  const productApplies = isInHand && acquisitionMethod === "PULLED";

  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return NextResponse.json({ error: "At least one card is required" }, { status: 400 });
  }

  // ── Validate each card entry ──────────────────────────────────────────────
  const cards: RawCardInput[] = [];
  for (let i = 0; i < rawCards.length; i++) {
    const c = rawCards[i] as Record<string, unknown>;
    const cardTemplateId = c?.cardTemplateId;
    if (typeof cardTemplateId !== "string" || !cardTemplateId) {
      return NextResponse.json({ error: "A card is required for every entry", cardIndex: i }, { status: 400 });
    }
    if (typeof c?.cardFrontImageUrl !== "string" || !c.cardFrontImageUrl) {
      return NextResponse.json({ error: "A card front image is required for every entry", cardIndex: i }, { status: 400 });
    }
    if (!isInHand && (typeof c?.notes !== "string" || !c.notes.trim())) {
      return NextResponse.json(
        { error: "Please add a note describing where you saw this card pulled", cardIndex: i },
        { status: 400 }
      );
    }
    cards.push({
      cardTemplateId,
      serialNumber:      typeof c.serialNumber === "number" ? c.serialNumber : null,
      cardFrontImageUrl: c.cardFrontImageUrl as string,
      cardBackImageUrl:  typeof c.cardBackImageUrl === "string" ? c.cardBackImageUrl : null,
      notes:             typeof c.notes === "string" ? c.notes : null,
    });
  }

  // ── Confirm every distinct card belongs to this set ───────────────────────
  const distinctCardIds = [...new Set(cards.map((c) => c.cardTemplateId))];
  const matchingCards = await prisma.checklistCard.findMany({
    where:  { id: { in: distinctCardIds }, cardSetId: setId },
    select: { id: true },
  });
  if (matchingCards.length !== distinctCardIds.length) {
    return NextResponse.json({ error: "One or more cards were not found in this set" }, { status: 404 });
  }

  // ── Reject in-batch collisions (two entries claiming the same serialized
  // copy) before even checking the database ────────────────────────────────
  const seenInBatch = new Map<string, number>(); // "checklistCardId:serialNumber" -> first index
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].serialNumber === null) continue;
    const key = `${cards[i].cardTemplateId}:${cards[i].serialNumber}`;
    const firstIndex = seenInBatch.get(key);
    if (firstIndex !== undefined) {
      return NextResponse.json(
        { error: `Entries #${firstIndex + 1} and #${i + 1} have the same card and serial number`, cardIndex: i },
        { status: 400 }
      );
    }
    seenInBatch.set(key, i);
  }

  // ── Pre-check duplicates against existing data for every card BEFORE
  // creating any of them — one card conflicting fails the whole batch. ─────
  const duplicateMatches = await Promise.all(
    cards.map((c) => findDuplicateMatch(c.cardTemplateId, c.serialNumber))
  );
  const conflictIndex = duplicateMatches.findIndex((m) => m !== null);
  if (conflictIndex !== -1) {
    const match = duplicateMatches[conflictIndex]!;
    const { duplicateKind, existingGel } = shapeDuplicateResponse(match, userId);
    return NextResponse.json(
      {
        error: `Card #${conflictIndex + 1} (serial #${match.serialNumber}) was already logged — remove it or correct the serial number before submitting.`,
        cardIndex: conflictIndex,
        duplicateKind,
        existingGel,
      },
      { status: 409 }
    );
  }

  // Trusted users (5+ gels already verified) skip the review queue — same
  // rule as the single route, resolved once for the whole batch since it
  // doesn't depend on any individual card.
  const loggingUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isVerifiedUser: true },
  });
  const isVerified = loggingUser?.isVerifiedUser ?? false;

  const sharedFields = {
    userId,
    setId,
    isInHand,
    isVerified,
    duplicateFlag: "NONE" as const,
    acquisitionMethod: typeof acquisitionMethod === "string" ? acquisitionMethod : null,
    productType:       productApplies && typeof productType === "string" ? productType : null,
    productTypeOther:  productApplies && typeof productTypeOther === "string" ? productTypeOther : null,
    hitYear:           typeof hitYear    === "number" ? hitYear    : null,
    hitMonth:          typeof hitMonth   === "number" ? hitMonth   : null,
    hitCity:           typeof hitCity    === "string" ? hitCity    : null,
    hitCountry:        typeof hitCountry === "string" ? hitCountry : null,
    seller:            typeof seller     === "string" ? seller     : null,
  };

  const gels = await Promise.all(
    cards.map((c) =>
      createGelRow({
        ...sharedFields,
        checklistCardId:   c.cardTemplateId,
        serialNumber:      c.serialNumber,
        cardFrontImageUrl: c.cardFrontImageUrl,
        cardBackImageUrl:  c.cardBackImageUrl,
        notes:             c.notes,
      })
    )
  );

  if (isInHand) {
    await rememberGelLocationDefaults(userId, sharedFields.hitCity, sharedFields.hitCountry);
  }

  revalidateSetDetailCache(setId);

  return NextResponse.json({ gels }, { status: 201 });
}
