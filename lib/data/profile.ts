// lib/data/profile.ts
//
// Data layer for /profile, /profile/gels, and the public /u/[handle] view —
// a user's stats, their hand-picked Favorite Gels, and the full list of
// every gel they've personally logged (isInHand: true) across every set.

import { prisma } from "@/lib/prisma";
import type { GelEntry } from "@/components/set-detail/YourGels";
import { getUserTotalPacksOpened } from "@/lib/data/productOpenings";

export interface PublicProfileUser {
  id:           string;
  name:         string;
  handle:       string;
  profileImage: string | null;
  createdAt:    Date;
}

// Resolves a @handle (from the /u/[handle] URL) to the user it belongs to.
// Users without a handle (shouldn't happen — see generateUniqueHandle) are
// unreachable here, same as a handle that doesn't exist at all.
export async function getUserByHandle(handle: string): Promise<PublicProfileUser | null> {
  const user = await prisma.user.findUnique({
    where:  { handle },
    select: { id: true, name: true, handle: true, profileImage: true, createdAt: true },
  });
  if (!user || !user.handle) return null;
  return { id: user.id, name: user.name ?? "A user", handle: user.handle, profileImage: user.profileImage, createdAt: user.createdAt };
}

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
      cardNumber:    true,
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
      cardNumber:    pc.checklistCard.cardNumber ?? null,
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
  setsOpened:         number;
  packsOpened:        number;
  totalGels:          number;
  totalContributions: number;
}

// "Sets opened" — distinct sets the user has an actual own gel in.
// "Packs opened" — this user's "X Packs Opened" total across every set —
// see getUserTotalPacksOpened in lib/data/productOpenings.ts.
// "Total gels" — every own gel (isInHand: true) they've logged.
// "Total contributions" — own gels plus every "someone else's gel" report
// they've submitted, verified or not — a measure of total effort, not a
// trust-gated public stat like "Chases Pulled" is.
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [distinctSets, packsOpened, totalGels, totalContributions] = await Promise.all([
    prisma.portfolioCard.findMany({
      where:    { userId, isInHand: true },
      select:   { cardSetId: true },
      distinct: ["cardSetId"],
    }),
    getUserTotalPacksOpened(userId),
    prisma.portfolioCard.count({ where: { userId, isInHand: true } }),
    prisma.portfolioCard.count({ where: { userId } }),
  ]);

  return {
    setsOpened: distinctSets.length,
    packsOpened,
    totalGels,
    totalContributions,
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
