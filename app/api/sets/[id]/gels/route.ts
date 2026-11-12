// app/api/sets/[id]/gels/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { rememberGelLocationDefaults, rememberSightingDefaults } from "@/lib/data/userGelDefaults";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import { findDuplicateMatch, shapeDuplicateResponse, createGelRow, openDuplicateFile, isGelAlreadyFiled, GelAlreadyFiledError } from "@/lib/data/gels";

// ─── POST /api/sets/[id]/gels ─────────────────────────────────────────────────
// Creates a new PortfolioCard (gel) for the current user. For logging
// several cards that share the same acquisition/date/location details in
// one request, see the batch sibling at app/api/sets/[id]/gels/batch/route.ts.
//
// Body fields:
//   cardTemplateId     — required. Despite the name, this is the id of a
//                        ChecklistCard row — ChecklistCard is the only real
//                        card catalog table now (see prisma/schema.prisma).
//                        The field is still called "cardTemplateId" on the
//                        wire so the existing AddGelModal request/response
//                        shape doesn't need to change in this step.
//   loggedFor          — "SELF" (default) or "OTHER". "SELF" means the
//                        logging user actually has this card in hand;
//                        "OTHER" means they're just reporting a card they
//                        saw someone else pull/sell online. Drives isInHand.
//   acquisitionMethod  — optional enum string. For loggedFor "SELF":
//                        "PULLED" | "BOUGHT". For "OTHER": "BREAKER" |
//                        "EBAY" | "FRIEND" | "SOCIAL_MEDIA" | "INFLUENCER" |
//                        "OTHER".
//   productType        — optional ProductType enum string (e.g. "HOBBY_BOX")
//                        — only stored when loggedFor is "SELF" and
//                        acquisitionMethod is "PULLED"; ignored otherwise.
//   productTypeOther   — optional string, only meaningful when productType
//                        is "OTHER".
//   serialNumber       — optional number
//   hitYear            — optional number
//   hitMonth           — optional number
//   hitCity            — optional string
//   hitCountry         — optional string
//   cardFrontImageUrl  — required (every logged gel needs a front image)
//   cardBackImageUrl   — optional string
//   seller             — optional string
//   breakerName        — required when acquisitionMethod is "BREAKER"
//                        (either loggedFor), otherwise ignored.
//   influencerHandle   — required when acquisitionMethod is "INFLUENCER"
//                        (loggedFor "OTHER" only — SELF never sends this
//                        value), otherwise ignored.
//   notes              — required for loggedFor "OTHER" unless
//                        acquisitionMethod is "BREAKER" or "INFLUENCER";
//                        always optional for loggedFor "SELF".
//   acknowledgeDuplicate — optional boolean. Only meaningful when another
//                        user already logged a gel with the same
//                        checklistCardId + serialNumber (see below) — set
//                        true once the user has seen that warning and
//                        clicked "File a Duplicate" to proceed anyway.
//
// Duplicate handling (serialized cards only — a null serialNumber never
// triggers this): if checklistCardId + serialNumber matches an existing
// PortfolioCard —
//   - same user, no confirmation yet  → 409 { duplicateKind: "SELF", ... }
//     without creating anything. The frontend's resolution is to PATCH the
//     existing gel instead of POSTing again (see
//     app/api/sets/[id]/gels/[gelId]/route.ts) — no "confirm" flag needed
//     here since that path never re-POSTs.
//   - different user, new gel owned (isInHand) and the match is only a
//     reported sighting (!isInHand), no acknowledgeDuplicate →
//     409 { duplicateKind: "CLAIM", ... } — the new logger may actually
//     own the physical card someone else just reported seeing.
//   - different user, anything else, no acknowledgeDuplicate →
//     409 { duplicateKind: "OTHER", ... } without creating anything, so
//     the user can double check their info.
//   - different user, acknowledgeDuplicate: true → creates the gel as
//     usual (forced unverified) AND opens a DuplicateGelFile (fileType
//     CLAIM or DUPLICATE, matching whichever 409 above would have fired)
//     for the developer to review at /admin/duplicate-gels.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
  //                     ↑ FIX 1a: Tell TypeScript that params is a Promise
) {
  // ── 1. Auth guard ────────────────────────────────────────────────────────────
  // Check the user is signed in. If not, return 401 immediately.
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const userId = session.user.id;

  // ── FIX 1b: Await params before reading any property from it ─────────────────
  // In Next.js 15, params is a Promise. You MUST await it first or the value
  // will be undefined, causing the database call to fail silently.
  const { id: setId } = await params;

  // ── 2. Parse the request body ────────────────────────────────────────────────
  // The modal sends data as JSON. If it's malformed, return a 400 error.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    cardTemplateId: checklistCardId,
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
    breakerName,
    breakerProfileId,
    influencerHandle,
    notes,
    acknowledgeDuplicate,
  } = body;

  // isInHand is derived server-side from loggedFor, rather than trusting a
  // client-sent boolean directly, so there's one unambiguous place deciding
  // what counts as "this user's own gel" vs. "a reported sighting."
  const isInHand = loggedFor !== "OTHER";

  // "Which Product" applies to "Pulled" (SELF only — OTHER never sends this
  // value) and "Breaker" (either flow, since a break can be either an
  // owned pull or a reported sighting) — re-derived server-side rather
  // than trusting the client honored the form's enabled/disabled state.
  const productApplies = acquisitionMethod === "PULLED" || acquisitionMethod === "BREAKER";
  // Only required for "Pulled" — a breaker often can't say exactly which
  // product a given card came from, so it stays optional for BREAKER.
  const productRequired = acquisitionMethod === "PULLED";

  // ── 3. Validate required fields ──────────────────────────────────────────────
  if (!checklistCardId || typeof checklistCardId !== "string") {
    return NextResponse.json(
      { error: "cardTemplateId is required" },
      { status: 400 }
    );
  }

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

  // ── 4. Confirm the checklist card belongs to this set ─────────────────────────
  // Security check — prevents attaching a card from a different set.
  const checklistCard = await prisma.checklistCard.findFirst({
    where: { id: checklistCardId, cardSetId: setId },
    select: { id: true, cardTier: true },
  });

  if (!checklistCard) {
    return NextResponse.json(
      { error: "Card not found in this set" },
      { status: 404 }
    );
  }

  const validSerialNumber = typeof serialNumber === "number" ? serialNumber : null;
  if (checklistCard.cardTier === "NUMBERED" && validSerialNumber === null) {
    return NextResponse.json(
      { error: "This card is numbered — please fill in the serial number" },
      { status: 400 }
    );
  }

  // ── 4b. Duplicate check (serialized cards only) ───────────────────────────────
  const duplicateMatch = await findDuplicateMatch(checklistCardId, validSerialNumber);

  if (duplicateMatch && duplicateMatch.userId === userId) {
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
  // The new gel is owned and the match is only a reported sighting — the
  // logger is claiming it as their own physical copy, not reporting a
  // conflicting duplicate. Re-derived server-side, never trusted from the
  // client, same as every other flag in this route.
  const isClaim = isFilingDuplicate && isInHand && duplicateMatch !== null && !duplicateMatch.isInHand;

  if (isFilingDuplicate && duplicateMatch && await isGelAlreadyFiled(duplicateMatch.id)) {
    return NextResponse.json(
      { error: "This card is already part of an open review." },
      { status: 409 }
    );
  }

  // Trusted users (5+ gels already verified by the developer) skip the
  // review queue entirely — see app/api/admin/gels/[gelId]/verify/route.ts
  // for where that trust is granted. Filing a duplicate always forces
  // unverified regardless of trust level.
  const loggingUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isVerifiedUser: true },
  });
  const isVerified = isFilingDuplicate ? false : (loggingUser?.isVerifiedUser ?? false);

  // Re-derived server-side, never trusted from the client directly — only
  // accept a BreakerProfile link when acquisitionMethod is BREAKER and the
  // profile actually has at least one attributed opening in THIS set (see
  // lib/data/breakerProfiles.ts's getBreakerOptionsForSet, which drives the
  // dropdown this id is supposed to have come from).
  const resolvedBreakerProfileId =
    acquisitionMethod === "BREAKER" && typeof breakerProfileId === "string" && breakerProfileId
      ? (await prisma.breakerProductOpening.findFirst({
          where:  { breakerProfileId, setProduct: { cardSetId: setId } },
          select: { id: true },
        })) ? breakerProfileId : null
      : null;

  // ── 5. Create the PortfolioCard ──────────────────────────────────────────────
  const gel = await createGelRow({
    userId,
    setId,
    checklistCardId,
    isInHand,
    isVerified,
    duplicateFlag:     isFilingDuplicate ? (isClaim ? "CLAIMING" : "PENDING") : "NONE",
    acquisitionMethod: typeof acquisitionMethod === "string" ? acquisitionMethod : null,
    productType:       productApplies && typeof productType === "string" ? productType : null,
    productTypeOther:  productApplies && typeof productTypeOther === "string" ? productTypeOther : null,
    serialNumber:      validSerialNumber,
    hitYear:           typeof hitYear    === "number" ? hitYear    : null,
    hitMonth:          typeof hitMonth   === "number" ? hitMonth   : null,
    hitCity:           typeof hitCity    === "string" ? hitCity    : null,
    hitCountry:        typeof hitCountry === "string" ? hitCountry : null,
    cardFrontImageUrl: typeof cardFrontImageUrl === "string" ? cardFrontImageUrl : null,
    cardBackImageUrl:  typeof cardBackImageUrl  === "string" ? cardBackImageUrl  : null,
    seller:            typeof seller === "string" ? seller : null,
    breakerName:       typeof breakerName === "string" ? breakerName : null,
    breakerProfileId:  resolvedBreakerProfileId,
    influencerHandle:  typeof influencerHandle === "string" ? influencerHandle : null,
    notes:             typeof notes  === "string" ? notes  : null,
  });

  // "My own gel" submissions update the remembered City/Country defaults;
  // "someone else's gel" sightings update a separate remembered
  // source/month/year/country bucket instead — see lib/data/userGelDefaults.ts.
  if (isInHand) {
    await rememberGelLocationDefaults(
      userId,
      typeof hitCity === "string" ? hitCity : null,
      typeof hitCountry === "string" ? hitCountry : null
    );
  } else {
    await rememberSightingDefaults(
      userId,
      acquisitionMethod,
      typeof hitMonth   === "number" ? hitMonth   : null,
      typeof hitYear    === "number" ? hitYear    : null,
      typeof hitCountry === "string" ? hitCountry : null
    );
  }

  // Filing a duplicate or claim: flag the pre-existing gel too and open
  // the case file for the developer to review at /admin/duplicate-gels.
  if (isFilingDuplicate && duplicateMatch) {
    try {
      await openDuplicateFile(checklistCardId, userId, gel.id, duplicateMatch.id, isClaim ? "CLAIM" : "DUPLICATE");
    } catch (error) {
      if (error instanceof GelAlreadyFiledError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  // A new gel changes this set's cached checklist-row status/gelsPulled/
  // cardHistory and chasesPulledInSet — invalidate the shared cache so
  // every other viewer's next load reflects it immediately.
  revalidateSetDetailCache(setId);

  return NextResponse.json({ gel }, { status: 201 });
}
