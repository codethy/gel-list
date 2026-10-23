// lib/data/profile.ts
//
// Data layer for /profile and /profile/gels — the signed-in user's own
// stats, their hand-picked Favorite Gels, and the full list of every gel
// they've personally logged (isInHand: true) across every set.

import { prisma } from "@/lib/prisma";
import type { GelEntry } from "@/components/set-detail/YourGels";

const portfolioCardSelect = {
  id:                true,
  cardSetId:         true,
  isInHand:          true,
  isVerified:        true,
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
  productType:       true,
  productTypeOther:  true,
  checklistCard: {
    select: {
      id:            true,
      playerName:    true,
      cardCategory:  true,
      parallel:      true,
      printRun:      true,
      variationName: true,
      team:          true,
    },
  },
  cardSet: {
    select: { id: true, name: true },
  },
} as const;

type PortfolioCardWithRelations = Awaited<
  ReturnType<typeof fetchOnePortfolioCardForShape>
>;

// Never actually called — exists purely so the type above can be derived
// from the real Prisma return shape instead of hand-duplicated by eye.
async function fetchOnePortfolioCardForShape() {
  return prisma.portfolioCard.findFirstOrThrow({ select: portfolioCardSelect });
}

function shapeGelEntry(pc: PortfolioCardWithRelations): GelEntry & { cardSetId: string; setName: string } {
  return {
    id:                pc.id,
    cardTemplateId:    pc.checklistCard.id,
    isInHand:          pc.isInHand,
    isVerified:        pc.isVerified,
    acquisitionMethod: pc.acquisitionMethod != null ? String(pc.acquisitionMethod) : null,
    serialNumber:      pc.serialNumber      ?? null,
    hitYear:           pc.hitYear           ?? null,
    hitMonth:          pc.hitMonth          ?? null,
    hitCity:           pc.hitCity           ?? null,
    hitCountry:        pc.hitCountry        ?? null,
    cardFrontImageUrl: pc.cardFrontImageUrl ?? null,
    cardBackImageUrl:  pc.cardBackImageUrl  ?? null,
    seller:            pc.seller            ?? null,
    notes:             pc.notes             ?? null,
    productType:       pc.productType != null ? String(pc.productType) : null,
    productTypeOther:  pc.productTypeOther  ?? null,
    cardSetId:         pc.cardSetId,
    setName:           pc.cardSet.name,
    cardTemplate: {
      playerName:    pc.checklistCard.playerName,
      cardType:      String(pc.checklistCard.cardCategory),
      parallelType:  pc.checklistCard.parallel ?? null,
      printRun:      pc.checklistCard.printRun ?? null,
      variationName: pc.checklistCard.variationName ?? null,
      team:          pc.checklistCard.team     ?? null,
    },
  };
}

export interface ProfileStats {
  setsOpened:        number;
  totalGels:         number;
  totalContributions: number;
  likesReceived:     number;
}

// "Sets opened" — distinct sets the user has an actual own gel in.
// "Total gels" — every own gel (isInHand: true) they've logged.
// "Total contributions" — own gels plus every "someone else's gel" report
// they've submitted, verified or not — a measure of total effort, not a
// trust-gated public stat like "Chases Pulled" is.
// "Likes received" — total likes (ChecklistCardLike rows) on every checklist
// card the user owns a gel for. Likes live on the checklist card itself (see
// ChecklistCardLike), not on an individual gel, so this counts each owned
// checklist card once even if the user somehow logged more than one copy of it.
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [distinctSets, totalGels, totalContributions, ownedCards] = await Promise.all([
    prisma.portfolioCard.findMany({
      where:    { userId, isInHand: true },
      select:   { cardSetId: true },
      distinct: ["cardSetId"],
    }),
    prisma.portfolioCard.count({ where: { userId, isInHand: true } }),
    prisma.portfolioCard.count({ where: { userId } }),
    prisma.portfolioCard.findMany({
      where:    { userId, isInHand: true },
      select:   { checklistCardId: true },
      distinct: ["checklistCardId"],
    }),
  ]);

  const likesReceived = await prisma.checklistCardLike.count({
    where: { checklistCardId: { in: ownedCards.map((c) => c.checklistCardId) } },
  });

  return {
    setsOpened: distinctSets.length,
    totalGels,
    totalContributions,
    likesReceived,
  };
}

export type FavoriteGelEntry = GelEntry & { cardSetId: string; setName: string };

export async function getFavoriteGels(userId: string): Promise<FavoriteGelEntry[]> {
  const favorites = await prisma.favoriteGel.findMany({
    where:   { userId },
    orderBy: { order: "asc" },
    select:  { portfolioCard: { select: portfolioCardSelect } },
  });
  return favorites.map((f) => shapeGelEntry(f.portfolioCard));
}

export const MAX_FAVORITE_GELS = 6;

export type UserGelEntry = GelEntry & { cardSetId: string; setName: string };

// Every gel the user actually owns (isInHand: true), across every set —
// used by both the "All Your Gels" page and the Manage Favorites picker.
export async function getAllUserGels(userId: string): Promise<UserGelEntry[]> {
  const cards = await prisma.portfolioCard.findMany({
    where:   { userId, isInHand: true },
    orderBy: { createdAt: "desc" },
    select:  portfolioCardSelect,
  });
  return cards.map(shapeGelEntry);
}
