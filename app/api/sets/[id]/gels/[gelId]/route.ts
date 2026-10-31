// app/api/sets/[id]/gels/[gelId]/route.ts
//
// PATCH  — edit an existing PortfolioCard (gel) the current user owns.
// DELETE — remove an existing PortfolioCard (gel) the current user owns.
//
// Both require the gel to belong both to this set AND to the signed-in
// user — otherwise 404, so a request can't be used to probe whether a gel
// id exists or discover who owns it.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { rememberGelLocationDefaults } from "@/lib/data/userGelDefaults";
import { revalidateSetDetailCache } from "@/lib/data/sets";

async function resolveOwnedGel(setId: string, gelId: string, userId: string) {
  return prisma.portfolioCard.findFirst({
    where: { id: gelId, cardSetId: setId, userId },
    select: { id: true },
  });
}

// ─── PATCH /api/sets/[id]/gels/[gelId] ─────────────────────────────────────────
// Body fields (same shape as POST /api/sets/[id]/gels, minus cardTemplateId:
// editing a gel doesn't let you reassign it to a different checklist card):
//   loggedFor, acquisitionMethod, serialNumber, hitYear, hitMonth, hitCity,
//   hitCountry, cardFrontImageUrl (required), cardBackImageUrl, seller,
//   notes (required when loggedFor is "OTHER")

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gelId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: setId, gelId } = await params;

  const owned = await resolveOwnedGel(setId, gelId, userId);
  if (!owned) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

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
    serialNumber,
    hitYear,
    hitMonth,
    hitCity,
    hitCountry,
    cardFrontImageUrl,
    cardBackImageUrl,
    seller,
    notes,
  } = body;

  const isInHand = loggedFor !== "OTHER";

  // "Which Product" only ever applies to "my own gel, pulled it" — re-derived
  // server-side rather than trusting the client honored the form's
  // enabled/disabled state.
  const productApplies = isInHand && acquisitionMethod === "PULLED";

  if (typeof cardFrontImageUrl !== "string" || !cardFrontImageUrl) {
    return NextResponse.json(
      { error: "A card front image is required" },
      { status: 400 }
    );
  }

  if (!isInHand && (typeof notes !== "string" || !notes.trim())) {
    return NextResponse.json(
      { error: "Please add a note describing where you saw this card pulled" },
      { status: 400 }
    );
  }

  // Editing changes what the developer would be verifying, so it goes back
  // into the review queue — unless the user is already trusted, in which
  // case it stays auto-verified just like a fresh gel from them would.
  const loggingUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isVerifiedUser: true },
  });
  const isVerified = loggingUser?.isVerifiedUser ?? false;

  const portfolioCard = await prisma.portfolioCard.update({
    where: { id: gelId },
    data: {
      isInHand,
      isVerified,
      acquisitionMethod:
        typeof acquisitionMethod === "string"
          ? (acquisitionMethod as never)
          : null,
      productType:
        productApplies && typeof productType === "string"
          ? (productType as never)
          : null,
      productTypeOther:
        productApplies && typeof productTypeOther === "string"
          ? productTypeOther
          : null,
      serialNumber:
        typeof serialNumber === "number" ? serialNumber : null,
      hitYear:
        typeof hitYear === "number" ? hitYear : null,
      hitMonth:
        typeof hitMonth === "number" ? hitMonth : null,
      hitCity:
        typeof hitCity === "string" ? hitCity : null,
      hitCountry:
        typeof hitCountry === "string" ? hitCountry : null,
      cardFrontImageUrl:
        typeof cardFrontImageUrl === "string" ? cardFrontImageUrl : null,
      cardBackImageUrl:
        typeof cardBackImageUrl === "string" ? cardBackImageUrl : null,
      seller:
        typeof seller === "string" ? seller : null,
      notes:
        typeof notes === "string" ? notes : null,
    },
    select: {
      id:                true,
      checklistCardId:   true,
      isInHand:          true,
      isVerified:        true,
      acquisitionMethod: true,
      productType:       true,
      productTypeOther:  true,
      serialNumber:      true,
      hitYear:           true,
      hitMonth:          true,
      hitCity:           true,
      hitCountry:        true,
      cardFrontImageUrl: true,
      cardBackImageUrl:  true,
      seller:            true,
      notes:             true,
      checklistCard: {
        select: {
          playerName:    true,
          cardCategory:  true,
          parallel:      true,
          printRun:      true,
          variationName: true,
          team:          true,
        },
      },
    },
  });

  if (isInHand) {
    await rememberGelLocationDefaults(userId, hitCity, hitCountry);
  }

  revalidateSetDetailCache(setId);

  // Same field-name compatibility note as POST — see that route for why.
  const gel = {
    id:                portfolioCard.id,
    cardTemplateId:    portfolioCard.checklistCardId,
    isInHand:          portfolioCard.isInHand,
    isVerified:        portfolioCard.isVerified,
    acquisitionMethod: portfolioCard.acquisitionMethod ?? null,
    productType:       portfolioCard.productType ? String(portfolioCard.productType) : null,
    productTypeOther:  portfolioCard.productTypeOther  ?? null,
    serialNumber:      portfolioCard.serialNumber      ?? null,
    hitYear:           portfolioCard.hitYear           ?? null,
    hitMonth:          portfolioCard.hitMonth          ?? null,
    hitCity:           portfolioCard.hitCity           ?? null,
    hitCountry:        portfolioCard.hitCountry        ?? null,
    cardFrontImageUrl: portfolioCard.cardFrontImageUrl ?? null,
    cardBackImageUrl:  portfolioCard.cardBackImageUrl  ?? null,
    seller:            portfolioCard.seller            ?? null,
    notes:             portfolioCard.notes             ?? null,
    cardTemplate: {
      playerName:    portfolioCard.checklistCard.playerName,
      cardType:      String(portfolioCard.checklistCard.cardCategory),
      parallelType:  portfolioCard.checklistCard.parallel ?? null,
      printRun:      portfolioCard.checklistCard.printRun ?? null,
      variationName: portfolioCard.checklistCard.variationName ?? null,
      team:          portfolioCard.checklistCard.team     ?? null,
    },
  };

  return NextResponse.json({ gel });
}

// ─── DELETE /api/sets/[id]/gels/[gelId] ────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gelId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: setId, gelId } = await params;

  const owned = await resolveOwnedGel(setId, gelId, userId);
  if (!owned) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

  try {
    await prisma.portfolioCard.delete({ where: { id: gelId } });
  } catch (error) {
    // P2003: foreign key constraint failed — this gel has CardTransfer
    // history pointing at it, which the schema doesn't allow deleting out
    // from under. There's no real transfer feature wired up in the app yet,
    // so this is a defensive guard rather than an expected everyday case.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "This gel has transfer history and can't be deleted." },
        { status: 409 }
      );
    }
    throw error;
  }

  revalidateSetDetailCache(setId);

  return NextResponse.json({ success: true });
}
