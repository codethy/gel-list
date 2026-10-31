// app/api/sets/[id]/gels/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { rememberGelLocationDefaults } from "@/lib/data/userGelDefaults";
import { revalidateSetDetailCache } from "@/lib/data/sets";

// ─── POST /api/sets/[id]/gels ─────────────────────────────────────────────────
// Creates a new PortfolioCard (gel) for the current user.
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
//                        "EBAY" | "FRIEND" | "SOCIAL_MEDIA" | "OTHER".
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
//   notes              — optional for "SELF", required for "OTHER" (it's
//                        where the user records where/who they saw pull it)

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
    notes,
  } = body;

  // isInHand is derived server-side from loggedFor, rather than trusting a
  // client-sent boolean directly, so there's one unambiguous place deciding
  // what counts as "this user's own gel" vs. "a reported sighting."
  const isInHand = loggedFor !== "OTHER";

  // "Which Product" only ever applies to "my own gel, pulled it" — re-derived
  // server-side rather than trusting the client honored the form's
  // enabled/disabled state.
  const productApplies = isInHand && acquisitionMethod === "PULLED";

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

  if (!isInHand && (typeof notes !== "string" || !notes.trim())) {
    return NextResponse.json(
      { error: "Please add a note describing where you saw this card pulled" },
      { status: 400 }
    );
  }

  // ── 4. Confirm the checklist card belongs to this set ─────────────────────────
  // Security check — prevents attaching a card from a different set.
  const checklistCard = await prisma.checklistCard.findFirst({
    where: { id: checklistCardId, cardSetId: setId },
    select: { id: true },
  });

  if (!checklistCard) {
    return NextResponse.json(
      { error: "Card not found in this set" },
      { status: 404 }
    );
  }

  // Trusted users (5+ gels already verified by the developer) skip the
  // review queue entirely — see app/api/admin/gels/[gelId]/verify/route.ts
  // for where that trust is granted.
  const loggingUser = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isVerifiedUser: true },
  });
  const isVerified = loggingUser?.isVerifiedUser ?? false;

  // ── 5. Create the PortfolioCard ──────────────────────────────────────────────
  const portfolioCard = await prisma.portfolioCard.create({
    data: {
      // ── FIX 2: Use Prisma relation connect syntax instead of raw userId ──────
      // Prisma v7 requires you to connect related records using the relation
      // name ("user") and a nested "connect" object. Writing `userId` directly
      // is rejected. Prisma will handle writing the foreign key column for us.
      user: {
        connect: { id: userId },
      },
      cardSet: {
        connect: { id: setId },
      },
      checklistCard: {
        connect: { id: checklistCardId },
      },
      isInHand:   isInHand,
      isHit:      true,
      isVerified: isVerified,
      acquisitionMethod:
        typeof acquisitionMethod === "string"
          ? (acquisitionMethod as never)
          : undefined,
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

    // ── Return only the fields the frontend GelEntry type needs ──────────────
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

  // Only "my own gel" submissions update the remembered City/Country
  // defaults — a "someone else's gel" report isn't this user's own location.
  if (isInHand) {
    await rememberGelLocationDefaults(userId, hitCity, hitCountry);
  }

  // A new gel changes this set's cached checklist-row status/gelsPulled/
  // cardHistory and chasesPulledInSet — invalidate the shared cache so
  // every other viewer's next load reflects it immediately.
  revalidateSetDetailCache(setId);

  // ── 6. Shape the response to match the GelEntry type ─────────────────────────
  // Field names here (cardTemplateId, cardTemplate.cardType/parallelType) are
  // kept as-is even though the data now comes from ChecklistCard, so the
  // frontend (YourGels.tsx, SetDetailClient.tsx) doesn't need to change yet.
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

  return NextResponse.json({ gel }, { status: 201 });
}
