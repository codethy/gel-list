// app/api/admin/gels/[gelId]/route.ts
//
// PATCH  — the admin edits any logged gel's details, via the exact same
//          form (components/set-detail/AddGelModal.tsx, reused as-is by
//          components/admin/AdminEditGelModal.tsx) and the exact same
//          field set a user editing their own gel would see — so this
//          route accepts and validates the same body shape
//          app/api/sets/[id]/gels/[gelId]/route.ts does, no ownership
//          check (that's the point of this being admin-only). Unlike that
//          route, this one DOES honor cardTemplateId — the admin can
//          reassign a gel to a different existing card in the same set
//          (AddGelModal's `allowCardChange`, set only from the admin edit
//          path). Doesn't touch isVerified — verifying/rejecting is a
//          separate action,
//          see app/api/admin/gels/[gelId]/verify/route.ts, and an admin
//          correcting a typo shouldn't silently flip a gel's review state
//          either way.
// DELETE — the admin removes any logged gel outright.
//
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { prepareGelDeletionCleanup } from "@/lib/data/gels";
import { cleanupSupersededFile } from "@/lib/uploadthingCleanup";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gelId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gelId } = await params;

  const existing = await prisma.portfolioCard.findUnique({
    where:  { id: gelId },
    select: {
      id: true,
      cardSetId: true,
      checklistCardId: true,
      cardFrontImageUrl: true,
      cardBackImageUrl: true,
      checklistCard: { select: { cardTier: true } },
    },
  });
  if (!existing) {
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
    influencerHandle,
    notes,
  } = body;

  const isInHand = loggedFor !== "OTHER";

  // Reassigning to a different existing card in the same set — the
  // Review Queue's "Edit" action can change which ChecklistCard this gel
  // points to (components/set-detail/AddGelModal.tsx's `allowCardChange`,
  // only ever set true from the admin edit path). Scoped to this gel's own
  // set so a typo'd/foreign id can't silently move a gel into another set.
  let newChecklistCard: { id: string; cardTier: string } | null = null;
  if (typeof cardTemplateId === "string" && cardTemplateId && cardTemplateId !== existing.checklistCardId) {
    const match = await prisma.checklistCard.findFirst({
      where:  { id: cardTemplateId, cardSetId: existing.cardSetId },
      select: { id: true, cardTier: true },
    });
    if (!match) {
      return NextResponse.json({ error: "That card doesn't belong to this set" }, { status: 400 });
    }
    newChecklistCard = { id: match.id, cardTier: String(match.cardTier) };
  }
  const effectiveCardTier = newChecklistCard?.cardTier ?? existing.checklistCard.cardTier;

  // "Which Product" applies to "Pulled" (SELF only) and "Breaker" (either
  // flow) — same derivation as the user-facing edit route.
  // "Which Product" is always available for a "someone else's gel" report
  // (any source) — the reporting user may still know which product it
  // came from. For "my own gel" it's only relevant to "Pulled"/"Breaker".
  const productApplies = !isInHand || acquisitionMethod === "PULLED" || acquisitionMethod === "BREAKER";
  // Only required for "Pulled" — stays optional everywhere else.
  const productRequired = acquisitionMethod === "PULLED";

  if (typeof cardFrontImageUrl !== "string" || !cardFrontImageUrl) {
    return NextResponse.json({ error: "A card front image is required" }, { status: 400 });
  }

  if (typeof acquisitionMethod !== "string" || !acquisitionMethod) {
    return NextResponse.json({ error: "Please select how you got this card" }, { status: 400 });
  }

  if (acquisitionMethod === "BREAKER" && (typeof breakerName !== "string" || !breakerName.trim())) {
    return NextResponse.json({ error: "Please fill in the breaker's name" }, { status: 400 });
  }

  if (acquisitionMethod === "INFLUENCER" && (typeof influencerHandle !== "string" || !influencerHandle.trim())) {
    return NextResponse.json({ error: "Please fill in the influencer's handle" }, { status: 400 });
  }

  if (!isInHand && acquisitionMethod !== "BREAKER" && acquisitionMethod !== "INFLUENCER" && (typeof notes !== "string" || !notes.trim())) {
    return NextResponse.json({ error: "Please fill in the notes" }, { status: 400 });
  }

  if (productRequired && (typeof productType !== "string" || !productType)) {
    return NextResponse.json({ error: "Please select which product this came from" }, { status: 400 });
  }

  const validSerialNumber = typeof serialNumber === "number" ? serialNumber : null;
  if (effectiveCardTier === "NUMBERED" && validSerialNumber === null) {
    return NextResponse.json(
      { error: "This card is numbered — please fill in the serial number" },
      { status: 400 }
    );
  }

  const portfolioCard = await prisma.portfolioCard.update({
    where: { id: gelId },
    data: {
      isInHand,
      ...(newChecklistCard ? { checklistCardId: newChecklistCard.id } : {}),
      acquisitionMethod:
        typeof acquisitionMethod === "string" ? (acquisitionMethod as never) : null,
      productType:
        productApplies && typeof productType === "string" ? (productType as never) : null,
      productTypeOther:
        productApplies && typeof productTypeOther === "string" ? productTypeOther : null,
      serialNumber: validSerialNumber,
      hitYear:      typeof hitYear      === "number" ? hitYear      : null,
      hitMonth:     typeof hitMonth     === "number" ? hitMonth     : null,
      hitCity:      typeof hitCity      === "string" ? hitCity      : null,
      hitCountry:   typeof hitCountry   === "string" ? hitCountry   : null,
      cardFrontImageUrl: typeof cardFrontImageUrl === "string" ? cardFrontImageUrl : null,
      cardBackImageUrl:  typeof cardBackImageUrl  === "string" ? cardBackImageUrl  : null,
      seller:      typeof seller      === "string" ? seller      : null,
      purchaseLocation: typeof purchaseLocation === "string" ? purchaseLocation : null,
      breakerName: typeof breakerName === "string" ? breakerName : null,
      influencerHandle: typeof influencerHandle === "string" ? influencerHandle : null,
      notes:       typeof notes       === "string" ? notes       : null,
    },
    select: {
      id:                true,
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

  // Whatever image(s) this edit just replaced have nothing left
  // referencing them — see lib/uploadthingCleanup.ts.
  await Promise.all([
    cleanupSupersededFile(existing.cardFrontImageUrl, portfolioCard.cardFrontImageUrl),
    cleanupSupersededFile(existing.cardBackImageUrl, portfolioCard.cardBackImageUrl),
  ]);

  // Only needed when the card actually changed — the cached per-card
  // gel-count aggregate (lib/data/sets.ts's firstPageGelsCountByCardId)
  // depends on which checklistCardId this gel points to.
  if (newChecklistCard) {
    revalidateSetDetailCache(existing.cardSetId);
  }

  // Same field-name compatibility shape as the user-facing edit route
  // (app/api/sets/[id]/gels/[gelId]/route.ts) — AddGelModal's onSuccess
  // expects a GelEntry, regardless of which route produced it.
  const gel = {
    id:                portfolioCard.id,
    cardTemplateId:    portfolioCard.checklistCardId,
    isInHand:          portfolioCard.isInHand,
    isVerified:        portfolioCard.isVerified,
    duplicateFlag:     String(portfolioCard.duplicateFlag),
    acquisitionMethod: portfolioCard.acquisitionMethod ?? null,
    productType:       portfolioCard.productType ? String(portfolioCard.productType) : null,
    productTypeOther:  portfolioCard.productTypeOther  ?? null,
    serialNumber:      portfolioCard.serialNumber      ?? null,
    hitYear:           portfolioCard.hitYear           ?? null,
    hitMonth:          portfolioCard.hitMonth           ?? null,
    hitCity:           portfolioCard.hitCity           ?? null,
    hitCountry:        portfolioCard.hitCountry        ?? null,
    cardFrontImageUrl: portfolioCard.cardFrontImageUrl ?? null,
    cardBackImageUrl:  portfolioCard.cardBackImageUrl  ?? null,
    seller:            portfolioCard.seller            ?? null,
    purchaseLocation:  portfolioCard.purchaseLocation  ?? null,
    breakerName:       portfolioCard.breakerName        ?? null,
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ gelId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gelId } = await params;

  const existing = await prisma.portfolioCard.findUnique({
    where:  { id: gelId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

  const cleanup = await prepareGelDeletionCleanup(gelId);
  try {
    await prisma.portfolioCard.delete({ where: { id: gelId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "This gel has transfer history and can't be deleted." },
        { status: 409 }
      );
    }
    throw error;
  }
  await cleanup();

  return NextResponse.json({ success: true });
}
