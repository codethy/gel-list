// app/api/sets/[id]/gels/co-claim/route.ts
//
// POST — "Did you buy this?" / "Did you pull this?" (CardImageModal's "..."
// menu, see AddGelModal's coOwnPrefill). Unlike the sighting-claim flow
// (../route.ts's duplicateKind: "CLAIM"), this is for two real owned gels
// of the same physical card — A pulled it and sold it to B, or A bought
// it and B actually pulled it. Deliberately UI-driven via an explicit
// `targetGelId` rather than the serial-collision detector in
// lib/data/gels.ts's findDuplicateMatch: that detector only ever matches
// a non-null serialNumber, but most Pulled/Bought pairs are unserialized
// base cards, so there's no reliable signal to auto-detect "same physical
// card" without the user pointing at the specific gel directly.
//
// Body fields:
//   targetGelId        — required. The existing gel being co-claimed —
//                        must be owned (isInHand: true) by a different
//                        user. "Someone Else's" sightings aren't valid
//                        targets here (that's the sighting-claim flow).
//   acquisitionMethod  — required, "PULLED" or "BOUGHT" only (locked
//                        client-side by which button was clicked).
//   productType/productTypeOther — as the main route, only when
//                        acquisitionMethod is "PULLED".
//   hitYear/hitMonth/hitCity/hitCountry, cardFrontImageUrl (required),
//   cardBackImageUrl, seller, breakerName, influencerHandle, notes — same
//   as the main route (in practice always null here, since
//   acquisitionMethod is locked to PULLED/BOUGHT).
//
// No confirm-dialog round-trip: filling out and submitting this whole
// form already is the confirmation, unlike the generic duplicate/claim
// 409-then-confirm flow. Always opens a CO_OWNERSHIP DuplicateGelFile —
// if the target gel is already verified, the owner's confirm/deny/unsure
// notification fires immediately; otherwise it's deferred (see
// lib/data/notifications.ts's maybeSendPendingCoOwnershipNotifications).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { rememberGelLocationDefaults } from "@/lib/data/userGelDefaults";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import { createGelRow, openCoOwnershipFile, isGelAlreadyFiled, GelAlreadyFiledError } from "@/lib/data/gels";

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
    targetGelId,
    acquisitionMethod,
    productType,
    productTypeOther,
    hitYear,
    hitMonth,
    hitCity,
    hitCountry,
    cardFrontImageUrl,
    cardBackImageUrl,
    seller,
    breakerName,
    influencerHandle,
    notes,
  } = body;

  if (typeof targetGelId !== "string" || !targetGelId) {
    return NextResponse.json({ error: "targetGelId is required" }, { status: 400 });
  }

  if (acquisitionMethod !== "PULLED" && acquisitionMethod !== "BOUGHT") {
    return NextResponse.json({ error: 'acquisitionMethod must be "PULLED" or "BOUGHT"' }, { status: 400 });
  }

  if (typeof cardFrontImageUrl !== "string" || !cardFrontImageUrl) {
    return NextResponse.json({ error: "A card front image is required" }, { status: 400 });
  }

  const productApplies = acquisitionMethod === "PULLED";
  if (productApplies && (typeof productType !== "string" || !productType)) {
    return NextResponse.json({ error: "Please select which product this came from" }, { status: 400 });
  }

  const targetGel = await prisma.portfolioCard.findFirst({
    where: { id: targetGelId, cardSetId: setId },
    select: { id: true, userId: true, isInHand: true, isVerified: true, checklistCardId: true, serialNumber: true },
  });
  if (!targetGel) {
    return NextResponse.json({ error: "Gel not found in this set" }, { status: 404 });
  }
  if (!targetGel.isInHand) {
    return NextResponse.json({ error: "This gel is a reported sighting, not an owned copy" }, { status: 400 });
  }
  if (targetGel.userId === userId) {
    return NextResponse.json({ error: "You can't co-claim your own gel" }, { status: 400 });
  }

  if (await isGelAlreadyFiled(targetGelId)) {
    return NextResponse.json({ error: "This card is already part of an open review." }, { status: 409 });
  }

  const gel = await createGelRow({
    userId,
    setId,
    checklistCardId:   targetGel.checklistCardId,
    isInHand:          true,
    isVerified:        false,
    duplicateFlag:     "CLAIMING",
    acquisitionMethod,
    productType:       productApplies && typeof productType === "string" ? productType : null,
    productTypeOther:  productApplies && typeof productTypeOther === "string" ? productTypeOther : null,
    serialNumber:      targetGel.serialNumber,
    hitYear:           typeof hitYear    === "number" ? hitYear    : null,
    hitMonth:          typeof hitMonth   === "number" ? hitMonth   : null,
    hitCity:           typeof hitCity    === "string" ? hitCity    : null,
    hitCountry:        typeof hitCountry === "string" ? hitCountry : null,
    cardFrontImageUrl: cardFrontImageUrl,
    cardBackImageUrl:  typeof cardBackImageUrl === "string" ? cardBackImageUrl : null,
    seller:            typeof seller === "string" ? seller : null,
    breakerName:       typeof breakerName === "string" ? breakerName : null,
    influencerHandle:  typeof influencerHandle === "string" ? influencerHandle : null,
    notes:             typeof notes === "string" ? notes : null,
  });

  await rememberGelLocationDefaults(
    userId,
    typeof hitCity === "string" ? hitCity : null,
    typeof hitCountry === "string" ? hitCountry : null
  );

  try {
    await openCoOwnershipFile(targetGel.checklistCardId, userId, gel.id, targetGelId, targetGel.isVerified, targetGel.userId);
  } catch (error) {
    if (error instanceof GelAlreadyFiledError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  revalidateSetDetailCache(setId);

  return NextResponse.json({ gel }, { status: 201 });
}
