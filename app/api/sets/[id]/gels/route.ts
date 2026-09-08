// app/api/sets/[id]/gels/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// ─── POST /api/sets/[id]/gels ─────────────────────────────────────────────────
// Creates a new PortfolioCard (gel) for the current user.
//
// Body fields:
//   cardTemplateId     — required
//   acquisitionMethod  — optional enum string ("PULLED" | "BOUGHT")
//   serialNumber       — optional number
//   hitYear            — optional number
//   hitMonth           — optional number
//   hitCity            — optional string
//   hitCountry         — optional string
//   cardFrontImageUrl  — optional string
//   cardBackImageUrl   — optional string
//   seller             — optional string
//   notes              — optional string

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
    cardTemplateId,
    acquisitionMethod,
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

  // ── 3. Validate required fields ──────────────────────────────────────────────
  if (!cardTemplateId || typeof cardTemplateId !== "string") {
    return NextResponse.json(
      { error: "cardTemplateId is required" },
      { status: 400 }
    );
  }

  // ── 4. Confirm the card template belongs to this set ─────────────────────────
  // Security check — prevents attaching a card from a different set.
  const template = await prisma.cardTemplate.findFirst({
    where: { id: cardTemplateId, cardSetId: setId },
    select: { id: true },
  });

  if (!template) {
    return NextResponse.json(
      { error: "Card template not found in this set" },
      { status: 404 }
    );
  }

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
      cardTemplate: {
        connect: { id: cardTemplateId },
      },
      isInHand: true,
      isHit:    true,
      acquisitionMethod:
        typeof acquisitionMethod === "string"
          ? (acquisitionMethod as never)
          : undefined,
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
      cardTemplateId:    true,
      acquisitionMethod: true,
      serialNumber:      true,
      hitYear:           true,
      hitMonth:          true,
      hitCity:           true,
      hitCountry:        true,
      cardFrontImageUrl: true,
      cardBackImageUrl:  true,
      seller:            true,
      notes:             true,
      cardTemplate: {
        select: {
          playerName:   true,
          cardType:     true,
          parallelType: true,
          printRun:     true,
          team:         true,
        },
      },
    },
  });

  // ── 6. Shape the response to match the GelEntry type ─────────────────────────
  const gel = {
    id:                portfolioCard.id,
    cardTemplateId:    portfolioCard.cardTemplateId,
    acquisitionMethod: portfolioCard.acquisitionMethod ?? null,
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
      playerName:   portfolioCard.cardTemplate.playerName,
      cardType:     portfolioCard.cardTemplate.cardType,
      parallelType: portfolioCard.cardTemplate.parallelType ?? null,
      printRun:     portfolioCard.cardTemplate.printRun     ?? null,
      team:         portfolioCard.cardTemplate.team         ?? null,
    },
  };

  return NextResponse.json({ gel }, { status: 201 });
}
