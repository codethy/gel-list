// lib/data/gels.ts
//
// Shared logic between the single-gel and batch "Log a Gel" create paths
// (see app/api/sets/[id]/gels/route.ts and
// app/api/sets/[id]/gels/batch/route.ts) — the duplicate-match lookup, the
// actual PortfolioCard create + response-shaping, and opening a
// DuplicateGelFile. Pulled out so both routes call exactly the same code
// rather than two copies drifting apart.

import { prisma } from "@/lib/prisma";
import { createCoOwnershipRequestNotification } from "@/lib/data/notifications";

// ─── DUPLICATE MATCH ────────────────────────────────────────────────────────
// Two PortfolioCards sharing a checklistCardId + serialNumber means either
// this user double-logged their own card, or two different users are
// claiming the same numbered copy. A null serialNumber never matches
// anything (unserialized base cards are expected to have many owners).

export interface DuplicateMatch {
  id:                string;
  userId:            string;
  isInHand:          boolean;
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
      isInHand:          true,
      createdAt:         true,
      serialNumber:      true,
      cardFrontImageUrl: true,
      user: { select: { name: true, username: true, handle: true } },
    },
  });
}

// Shapes a DuplicateMatch into the { duplicateKind, existingGel } pair both
// routes return on a 409 — "OTHER"/"CLAIM" include who logged it (public
// info — name/handle, never email), "SELF" doesn't need to since it's the
// same user. "CLAIM": the new gel is owned (isInHand) and the match is only
// a reported sighting (!match.isInHand) — the new logger is claiming it as
// their own physical copy, rather than reporting a conflicting duplicate.
export function shapeDuplicateResponse(
  match: DuplicateMatch,
  requestingUserId: string,
  newGelIsInHand: boolean
) {
  const duplicateKind =
    match.userId === requestingUserId
      ? "SELF"
      : newGelIsInHand && !match.isInHand
      ? "CLAIM"
      : "OTHER";
  return {
    duplicateKind,
    existingGel: {
      id:                match.id,
      createdAt:         match.createdAt.toISOString(),
      serialNumber:      match.serialNumber,
      cardFrontImageUrl: match.cardFrontImageUrl,
      ...(duplicateKind === "OTHER" || duplicateKind === "CLAIM"
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
  duplicateFlag:     "NONE" | "PENDING" | "CLAIMING";
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
  breakerName:       string | null;
  breakerProfileId:  string | null;
  influencerHandle:  string | null;
  notes:             string | null;
}

export interface ShapedGel {
  id:                string;
  userId:            string;
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
  breakerName:       string | null;
  breakerProfileId:  string | null;
  influencerHandle:  string | null;
  notes:             string | null;
  cardTemplate: {
    playerName:    string;
    cardType:      string;
    cardTier:      string;
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
      breakerName:       input.breakerName,
      breakerProfile:    input.breakerProfileId != null ? { connect: { id: input.breakerProfileId } } : undefined,
      influencerHandle:  input.influencerHandle,
      notes:             input.notes,
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

  return {
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
}

// ─── DUPLICATE FILE ─────────────────────────────────────────────────────────
// Thrown instead of letting DuplicateGelFile's unique filedGelId/
// existingGelId constraints blow up as an unhandled P2002 — a gel can only
// ever be referenced by one open-or-closed file at a time (its whole
// history, not just while OPEN, since a CLOSED file is still a real
// record), so a second filing attempt against an already-filed gel needs
// a clean error instead of a 500.
export class GelAlreadyFiledError extends Error {
  constructor() {
    super("This card is already part of an open review.");
  }
}

// Call BEFORE creating a new gel when a duplicate/claim match was found —
// lets the route return a clean 409 without ever creating an orphaned gel
// that then fails to get filed. openDuplicateFile re-checks this itself
// right before its own create too, as a backstop against a race between
// two concurrent requests filing against the same existing gel.
export async function isGelAlreadyFiled(gelId: string): Promise<boolean> {
  const existing = await prisma.duplicateGelFile.findFirst({
    where:  { OR: [{ filedGelId: gelId }, { existingGelId: gelId }] },
    select: { id: true },
  });
  return existing !== null;
}

// Flags the pre-existing gel (it keeps its own isVerified as-is — only the
// new duplicateFlag tag is new for it) and opens the case file for the
// developer to review at /admin/duplicate-gels. `fileType` distinguishes a
// real duplicate-serial conflict (DUPLICATE — see AddGelModal's "File a
// Duplicate") from a user claiming a card someone else only reported
// seeing (CLAIM — "Claim this Card"); drives both the file's own type and
// which DuplicateFlag ("PENDING" vs "CLAIMING") both gels get. Only ever
// called from the single-gel create path — the batch path never
// auto-files (see app/api/sets/[id]/gels/batch/route.ts's doc comment for
// why).
export async function openDuplicateFile(
  checklistCardId: string,
  filedByUserId:   string,
  filedGelId:      string,
  existingGelId:   string,
  fileType:        "DUPLICATE" | "CLAIM"
): Promise<void> {
  if (await isGelAlreadyFiled(existingGelId) || await isGelAlreadyFiled(filedGelId)) {
    throw new GelAlreadyFiledError();
  }

  const duplicateFlag = fileType === "CLAIM" ? "CLAIMING" : "PENDING";

  await prisma.portfolioCard.update({
    where: { id: existingGelId },
    data:  { duplicateFlag },
  });
  await prisma.duplicateGelFile.create({
    data: {
      checklistCard: { connect: { id: checklistCardId } },
      filedByUser:   { connect: { id: filedByUserId } },
      filedGel:      { connect: { id: filedGelId } },
      existingGel:   { connect: { id: existingGelId } },
      fileType,
    },
  });
}

// Opens a CO_OWNERSHIP file — "Did you buy/pull this?" (AddGelModal/
// CardImageModal), where both gels are real owned copies of the same
// physical card (one Pulled, one Bought), not a conflicting duplicate or
// a sighting being claimed. Unlike openDuplicateFile, only the **new**
// (filed) gel gets flagged — the existing gel isn't in question, so its
// own badge is left exactly as it was. If the existing gel is already
// verified, the owner's confirm/deny/unsure notification fires
// immediately; otherwise the file starts PENDING and
// maybeSendPendingCoOwnershipNotifications (lib/data/notifications.ts)
// sends it later once that gel is verified.
export async function openCoOwnershipFile(
  checklistCardId:      string,
  filedByUserId:        string,
  filedGelId:           string,
  existingGelId:        string,
  existingGelIsVerified: boolean,
  existingGelOwnerId:   string
): Promise<void> {
  if (await isGelAlreadyFiled(existingGelId) || await isGelAlreadyFiled(filedGelId)) {
    throw new GelAlreadyFiledError();
  }

  const decision = existingGelIsVerified ? "CO_OWN_AWAITING_OWNER" : "PENDING";

  const file = await prisma.duplicateGelFile.create({
    data: {
      checklistCard: { connect: { id: checklistCardId } },
      filedByUser:   { connect: { id: filedByUserId } },
      filedGel:      { connect: { id: filedGelId } },
      existingGel:   { connect: { id: existingGelId } },
      fileType:      "CO_OWNERSHIP",
      decision,
    },
  });

  if (existingGelIsVerified) {
    await createCoOwnershipRequestNotification(file.id, existingGelOwnerId);
  }
}

// ─── DELETION CLEANUP ───────────────────────────────────────────────────────
// A gel referenced by an open DuplicateGelFile (any fileType) can be
// deleted outright via /admin/gels (the "False" verify action, or a
// direct delete) — onDelete: SetNull only nulls that one FK, leaving the
// surviving gel's duplicateFlag dangling forever with no partner left to
// resolve against. Call this with the gel's id BEFORE deleting it; it
// looks up any file involving that gel, and returns a callback the
// caller runs AFTER the delete succeeds to reset the survivor's flag
// (onDelete: SetNull has already nulled the FK by then, so the lookup
// has to happen first).
export async function prepareGelDeletionCleanup(gelId: string): Promise<() => Promise<void>> {
  const file = await prisma.duplicateGelFile.findFirst({
    where:  { OR: [{ filedGelId: gelId }, { existingGelId: gelId }] },
    select: { filedGelId: true, existingGelId: true },
  });
  if (!file) return async () => {};

  const survivorId = file.filedGelId === gelId ? file.existingGelId : file.filedGelId;
  if (!survivorId) return async () => {};

  return async () => {
    await prisma.portfolioCard.update({
      where: { id: survivorId },
      data:  { duplicateFlag: "NONE" },
    });
  };
}
