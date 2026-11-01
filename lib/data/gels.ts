// lib/data/gels.ts
//
// Shared logic between the single-gel and batch "Log a Gel" create paths
// (see app/api/sets/[id]/gels/route.ts and
// app/api/sets/[id]/gels/batch/route.ts) — the duplicate-match lookup, the
// actual PortfolioCard create + response-shaping, and opening a
// DuplicateGelFile. Pulled out so both routes call exactly the same code
// rather than two copies drifting apart.

import { prisma } from "@/lib/prisma";

// ─── DUPLICATE MATCH ────────────────────────────────────────────────────────
// Two PortfolioCards sharing a checklistCardId + serialNumber means either
// this user double-logged their own card, or two different users are
// claiming the same numbered copy. A null serialNumber never matches
// anything (unserialized base cards are expected to have many owners).

export interface DuplicateMatch {
  id:                string;
  userId:            string;
  createdAt:         Date;
  serialNumber:      number | null;
  cardFrontImageUrl: string | null;
  user: { name: string | null; username: string | null; handle: string | null };
}

export async function findDuplicateMatch(
  checklistCardId: string,
  serialNumber:    number | null
): Promise<DuplicateMatch | null> {
  if (serialNumber === null) return null;

  return prisma.portfolioCard.findFirst({
    where:   { checklistCardId, serialNumber },
    orderBy: { createdAt: "asc" },
    select: {
      id:                true,
      userId:            true,
      createdAt:         true,
      serialNumber:      true,
      cardFrontImageUrl: true,
      user: { select: { name: true, username: true, handle: true } },
    },
  });
}

// Shapes a DuplicateMatch into the { duplicateKind, existingGel } pair both
// routes return on a 409 — "OTHER" includes who logged it (public info —
// name/handle, never email), "SELF" doesn't need to since it's the same user.
export function shapeDuplicateResponse(match: DuplicateMatch, requestingUserId: string) {
  const duplicateKind = match.userId === requestingUserId ? "SELF" : "OTHER";
  return {
    duplicateKind,
    existingGel: {
      id:                match.id,
      createdAt:         match.createdAt.toISOString(),
      serialNumber:      match.serialNumber,
      cardFrontImageUrl: match.cardFrontImageUrl,
      ...(duplicateKind === "OTHER"
        ? {
            loggedByName:   match.user.name ?? match.user.username ?? "A user",
            loggedByHandle: match.user.handle,
          }
        : {}),
    },
  };
}

// ─── CREATE ─────────────────────────────────────────────────────────────────

export interface CreateGelRowInput {
  userId:            string;
  setId:             string;
  checklistCardId:   string;
  isInHand:          boolean;
  isVerified:        boolean;
  duplicateFlag:     "NONE" | "PENDING";
  acquisitionMethod: string | null;
  productType:       string | null;
  productTypeOther:  string | null;
  serialNumber:      number | null;
  hitYear:           number | null;
  hitMonth:          number | null;
  hitCity:           string | null;
  hitCountry:        string | null;
  cardFrontImageUrl: string | null;
  cardBackImageUrl:  string | null;
  seller:            string | null;
  notes:             string | null;
}

export interface ShapedGel {
  id:                string;
  cardTemplateId:    string;
  isInHand:          boolean;
  isVerified:        boolean;
  duplicateFlag:     string;
  acquisitionMethod: string | null;
  productType:       string | null;
  productTypeOther:  string | null;
  serialNumber:      number | null;
  hitYear:           number | null;
  hitMonth:          number | null;
  hitCity:           string | null;
  hitCountry:        string | null;
  cardFrontImageUrl: string | null;
  cardBackImageUrl:  string | null;
  seller:            string | null;
  notes:             string | null;
  cardTemplate: {
    playerName:    string;
    cardType:      string;
    parallelType:  string | null;
    printRun:      number | null;
    variationName: string | null;
    team:          string | null;
  };
}

// Creates one PortfolioCard and shapes it to match the GelEntry type the
// frontend expects (field names like cardTemplateId/cardTemplate are
// leftovers from the removed CardTemplate model, kept as-is on the wire —
// see the route-level doc comments for why).
export async function createGelRow(input: CreateGelRowInput): Promise<ShapedGel> {
  const portfolioCard = await prisma.portfolioCard.create({
    data: {
      user:          { connect: { id: input.userId } },
      cardSet:       { connect: { id: input.setId } },
      checklistCard: { connect: { id: input.checklistCardId } },
      isInHand:      input.isInHand,
      isHit:         true,
      isVerified:    input.isVerified,
      duplicateFlag: input.duplicateFlag,
      acquisitionMethod: input.acquisitionMethod != null ? (input.acquisitionMethod as never) : undefined,
      productType:       input.productType       != null ? (input.productType as never)      : null,
      productTypeOther:  input.productTypeOther,
      serialNumber:      input.serialNumber,
      hitYear:           input.hitYear,
      hitMonth:          input.hitMonth,
      hitCity:           input.hitCity,
      hitCountry:        input.hitCountry,
      cardFrontImageUrl: input.cardFrontImageUrl,
      cardBackImageUrl:  input.cardBackImageUrl,
      seller:            input.seller,
      notes:             input.notes,
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

  return {
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
}

// ─── DUPLICATE FILE ─────────────────────────────────────────────────────────
// Flags the pre-existing gel (it keeps its own isVerified as-is — only the
// "Possible Duplicate" tag is new for it) and opens the case file for the
// developer to review at /admin/duplicate-gels. Only ever called from the
// single-gel create path — the batch path never auto-files (see
// app/api/sets/[id]/gels/batch/route.ts's doc comment for why).
export async function openDuplicateFile(
  checklistCardId: string,
  filedByUserId:   string,
  filedGelId:      string,
  existingGelId:   string
): Promise<void> {
  await prisma.portfolioCard.update({
    where: { id: existingGelId },
    data:  { duplicateFlag: "PENDING" },
  });
  await prisma.duplicateGelFile.create({
    data: {
      checklistCard: { connect: { id: checklistCardId } },
      filedByUser:   { connect: { id: filedByUserId } },
      filedGel:      { connect: { id: filedGelId } },
      existingGel:   { connect: { id: existingGelId } },
    },
  });
}
