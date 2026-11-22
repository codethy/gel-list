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
import { rememberGelLocationDefaults, rememberSightingDefaults } from "@/lib/data/userGelDefaults";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import {
  prepareGelDeletionCleanup,
  findDuplicateMatch,
  shapeDuplicateResponse,
  openDuplicateFile,
  isGelAlreadyFiled,
  GelAlreadyFiledError,
} from "@/lib/data/gels";
import { maybeSendPendingCoOwnershipNotifications } from "@/lib/data/notifications";
import { cleanupSupersededFile } from "@/lib/uploadthingCleanup";

async function resolveOwnedGel(setId: string, gelId: string, userId: string) {
  return prisma.portfolioCard.findFirst({
    where:  { id: gelId, cardSetId: setId, userId },
    select: {
      id: true,
      checklistCardId: true,
      cardFrontImageUrl: true,
      cardBackImageUrl: true,
      checklistCard: { select: { cardTier: true } },
    },
  });
}

// ─── PATCH /api/sets/[id]/gels/[gelId] ─────────────────────────────────────────
// Body fields (same shape as POST /api/sets/[id]/gels):
//   cardTemplateId     — optional. Reassigns this gel to a different
//                        existing ChecklistCard in the same set (e.g. the
//                        user picked the wrong card name originally) — see
//                        AddGelModal's `allowCardChange`. Omitted/unchanged
//                        means "keep the current card." Re-runs this card's
//                        NUMBERED/serial-number requirement and the usual
//                        duplicate/claim check against the new card+serial,
//                        exactly as if this were a fresh log of that card.
//   loggedFor, acquisitionMethod, serialNumber, hitYear, hitMonth, hitCity,
//   hitCountry, cardFrontImageUrl (required), cardBackImageUrl, seller,
//   breakerName (required when acquisitionMethod is "BREAKER"),
//   influencerHandle (required when acquisitionMethod is "INFLUENCER"),
//   notes (required for loggedFor "OTHER" unless acquisitionMethod is
//   "BREAKER" or "INFLUENCER"; always optional for loggedFor "SELF")
//   acknowledgeDuplicate — optional boolean, same meaning as the create
//                        route: set once the user has seen the "someone
//                        else already logged/reported this" warning and
//                        chosen to proceed anyway. A collision with the
//                        user's OWN other gel is never offered this
//                        bypass — see the 409 handling below.

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
    cardTemplateId,
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
    purchaseLocation,
    breakerName,
    breakerProfileId,
    influencerHandle,
    notes,
    acknowledgeDuplicate,
  } = body;

  const isInHand = loggedFor !== "OTHER";

  // Reassigning to a different existing card in the same set — e.g. the
  // user picked the wrong card originally. Scoped to this gel's own set so
  // a typo'd/foreign id can't move a gel into another set.
  let newChecklistCard: { id: string; cardTier: string } | null = null;
  if (typeof cardTemplateId === "string" && cardTemplateId && cardTemplateId !== owned.checklistCardId) {
    const match = await prisma.checklistCard.findFirst({
      where:  { id: cardTemplateId, cardSetId: setId },
      select: { id: true, cardTier: true },
    });
    if (!match) {
      return NextResponse.json({ error: "That card doesn't belong to this set" }, { status: 400 });
    }
    newChecklistCard = { id: match.id, cardTier: String(match.cardTier) };
  }
  const effectiveChecklistCardId = newChecklistCard?.id ?? owned.checklistCardId;
  const effectiveCardTier = newChecklistCard?.cardTier ?? owned.checklistCard.cardTier;

  // "Which Product" applies to "Pulled" (SELF only) and "Breaker" (either
  // flow) — re-derived server-side rather than trusting the client honored
  // the form's enabled/disabled state.
  // "Which Product" is always available for a "someone else's gel" report
  // (any source) — the reporting user may still know which product it
  // came from. For "my own gel" it's only relevant to "Pulled"/"Breaker".
  const productApplies = !isInHand || acquisitionMethod === "PULLED" || acquisitionMethod === "BREAKER";
  // Only required for "Pulled" — stays optional everywhere else.
  const productRequired = acquisitionMethod === "PULLED";

  if (typeof cardFrontImageUrl !== "string" || !cardFrontImageUrl) {
    return NextResponse.json(
      { error: "A card front image is required" },
      { status: 400 }
    );
  }

  if (typeof acquisitionMethod !== "string" || !acquisitionMethod) {
    return NextResponse.json(
      { error: "Please select how you got this card" },
      { status: 400 }
    );
  }

  if (acquisitionMethod === "BREAKER" && (typeof breakerName !== "string" || !breakerName.trim())) {
    return NextResponse.json(
      { error: "Please fill in the breaker's name" },
      { status: 400 }
    );
  }

  if (acquisitionMethod === "INFLUENCER" && (typeof influencerHandle !== "string" || !influencerHandle.trim())) {
    return NextResponse.json(
      { error: "Please fill in the influencer's handle" },
      { status: 400 }
    );
  }

  if (!isInHand && acquisitionMethod !== "BREAKER" && acquisitionMethod !== "INFLUENCER" && (typeof notes !== "string" || !notes.trim())) {
    return NextResponse.json(
      { error: "Please fill in the notes" },
      { status: 400 }
    );
  }

  if (productRequired && (typeof productType !== "string" || !productType)) {
    return NextResponse.json(
      { error: "Please select which product this came from" },
      { status: 400 }
    );
  }

  const validSerialNumber = typeof serialNumber === "number" ? serialNumber : null;
  if (effectiveCardTier === "NUMBERED" && validSerialNumber === null) {
    return NextResponse.json(
      { error: "This card is numbered — please fill in the serial number" },
      { status: 400 }
    );
  }

  // ── Duplicate check (serialized cards only) — same rule as the create
  // route, re-run against the (possibly just-changed) card+serial. Excludes
  // this gel itself, since it already legitimately "matches" its own
  // current checklistCardId+serialNumber. ───────────────────────────────────
  const duplicateMatch = await findDuplicateMatch(effectiveChecklistCardId, validSerialNumber, gelId);

  if (duplicateMatch && duplicateMatch.userId === userId) {
    // Never offered a merge/replace here — see AddGelModal's duplicatePrompt
    // UI, which shows an acknowledge-only dialog for this case on edit.
    const { duplicateKind, existingGel } = shapeDuplicateResponse(duplicateMatch, userId, isInHand);
    return NextResponse.json(
      { error: "You've already logged this exact gel.", duplicateKind, existingGel },
      { status: 409 }
    );
  }

  if (duplicateMatch && duplicateMatch.userId !== userId && acknowledgeDuplicate !== true) {
    const { duplicateKind, existingGel } = shapeDuplicateResponse(duplicateMatch, userId, isInHand);
    const error =
      duplicateKind === "CLAIM"
        ? "Someone else has reported seeing this exact card."
        : "Someone else has already logged this exact card.";
    return NextResponse.json({ error, duplicateKind, existingGel }, { status: 409 });
  }

  const isFilingDuplicate = duplicateMatch !== null && duplicateMatch.userId !== userId && acknowledgeDuplicate === true;
  const isClaim = isFilingDuplicate && isInHand && duplicateMatch !== null && !duplicateMatch.isInHand;

  if (isFilingDuplicate && duplicateMatch && await isGelAlreadyFiled(duplicateMatch.id)) {
    return NextResponse.json(
      { error: "This card is already part of an open review." },
      { status: 409 }
    );
  }

  // Editing changes what the developer would be verifying, so it goes back
  // into the review queue — unless the user is already trusted, in which
  // case it stays auto-verified just like a fresh gel from them would.
  // Filing a duplicate always forces unverified regardless of trust level,
  // same rule as the create route.
  const loggingUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isVerifiedUser: true },
  });
  const isVerified = isFilingDuplicate ? false : (loggingUser?.isVerifiedUser ?? false);

  // Re-derived server-side, same rule as the create route.
  const resolvedBreakerProfileId =
    acquisitionMethod === "BREAKER" && typeof breakerProfileId === "string" && breakerProfileId
      ? (await prisma.breakerProductOpening.findFirst({
          where:  { breakerProfileId, setProduct: { cardSetId: setId } },
          select: { id: true },
        })) ? breakerProfileId : null
      : null;

  const portfolioCard = await prisma.portfolioCard.update({
    where: { id: gelId },
    data: {
      isInHand,
      isVerified,
      ...(newChecklistCard ? { checklistCardId: newChecklistCard.id } : {}),
      ...(isFilingDuplicate ? { duplicateFlag: isClaim ? "CLAIMING" : "PENDING" } : {}),
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
      serialNumber: validSerialNumber,
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
      purchaseLocation:
        typeof purchaseLocation === "string" ? purchaseLocation : null,
      breakerName:
        typeof breakerName === "string" ? breakerName : null,
      breakerProfileId: resolvedBreakerProfileId,
      influencerHandle:
        typeof influencerHandle === "string" ? influencerHandle : null,
      notes:
        typeof notes === "string" ? notes : null,
    },
    select: {
      id:                true,
      userId:            true,
      checklistCardId:   true,
      isInHand:          true,
      isVerified:        true,
      duplicateFlag:     true,
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
      purchaseLocation:  true,
      breakerName:       true,
      breakerProfileId:  true,
      influencerHandle:  true,
      notes:             true,
      checklistCard: {
        select: {
          playerName:    true,
          cardCategory:  true,
          cardTier:      true,
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
  } else {
    await rememberSightingDefaults(userId, acquisitionMethod, hitMonth, hitYear, hitCountry);
  }

  // Filing a duplicate or claim (only reachable with acknowledgeDuplicate,
  // which only ever applies to someone else's gel, never the user's own —
  // see the 409 handling above): flag the other gel too and open the case
  // file for the developer to review, same as the create route.
  if (isFilingDuplicate && duplicateMatch) {
    try {
      await openDuplicateFile(effectiveChecklistCardId, userId, gelId, duplicateMatch.id, isClaim ? "CLAIM" : "DUPLICATE");
    } catch (error) {
      if (error instanceof GelAlreadyFiledError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  // A CO_OWNERSHIP file may have been waiting on exactly this gel to be
  // verified before notifying its owner — see lib/data/notifications.ts.
  // Harmless to call when it was already verified before this edit too;
  // the helper only acts on files still PENDING.
  if (isVerified) {
    await maybeSendPendingCoOwnershipNotifications(gelId);
  }

  // Whatever image(s) this edit just replaced have nothing left
  // referencing them — otherwise they'd sit in UploadThing storage
  // forever (URLs are content-addressed, so a new upload never reuses
  // the old key).
  await Promise.all([
    cleanupSupersededFile(owned.cardFrontImageUrl, portfolioCard.cardFrontImageUrl),
    cleanupSupersededFile(owned.cardBackImageUrl, portfolioCard.cardBackImageUrl),
  ]);

  revalidateSetDetailCache(setId);

  // Same field-name compatibility note as POST — see that route for why.
  const gel = {
    id:                portfolioCard.id,
    userId:            portfolioCard.userId,
    cardTemplateId:    portfolioCard.checklistCardId,
    isInHand:          portfolioCard.isInHand,
    isVerified:        portfolioCard.isVerified,
    duplicateFlag:     String(portfolioCard.duplicateFlag),
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
    purchaseLocation:  portfolioCard.purchaseLocation  ?? null,
    breakerName:       portfolioCard.breakerName        ?? null,
    breakerProfileId:  portfolioCard.breakerProfileId   ?? null,
    influencerHandle:  portfolioCard.influencerHandle   ?? null,
    notes:             portfolioCard.notes             ?? null,
    cardTemplate: {
      playerName:    portfolioCard.checklistCard.playerName,
      cardType:      String(portfolioCard.checklistCard.cardCategory),
      cardTier:      String(portfolioCard.checklistCard.cardTier),
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

  const cleanup = await prepareGelDeletionCleanup(gelId);
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
  await cleanup();

  revalidateSetDetailCache(setId);

  return NextResponse.json({ success: true });
}
