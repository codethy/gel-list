// lib/data/adminGels.ts
//
// Data layer for /admin/gels — the Gel Review Queue. A single, flat,
// paginated, searchable list split into two tabs (Not Verified / Verified)
// rather than grouped by set — see components/admin/AdminGelsClient.tsx.
// Not Verified sorts oldest-first (the longest-waiting submissions surface
// first); Verified sorts newest-first (the most recent decisions are what's
// visible without paging back) — see getReviewQueueGels below.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface AdminGelEntry {
  id:                  string;
  // The gel's own set and owner — needed so the review queue can show a
  // set-name badge per row (no more set-grouping) and so AdminEditGelModal
  // can fetch that set's category/year/product catalog to open the exact
  // same Log a Gel form the user themself would see.
  setId:               string;
  setName:             string;
  userId:              string;
  isInHand:            boolean;
  isVerified:          boolean;
  duplicateFlag:       string;
  acquisitionMethod:   string | null;
  productType:         string | null;
  productTypeOther:    string | null;
  serialNumber:        number | null;
  hitYear:             number | null;
  hitMonth:            number | null;
  hitCity:             string | null;
  hitCountry:          string | null;
  cardFrontImageUrl:   string | null;
  cardBackImageUrl:    string | null;
  seller:              string | null;
  breakerName:         string | null;
  notes:               string | null;
  createdAt:           string;
  loggedByUsername:    string;
  loggedByDisplayName: string | null;
  checklistCard: {
    id:            string;
    cardNumber:    string | null;
    playerName:    string;
    cardType:      string;
    cardTier:      string;
    parallelType:  string | null;
    printRun:      number | null;
    variationName: string | null;
    team:          string | null;
  };
}

const adminGelSelect = {
  id:                true,
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
  notes:             true,
  createdAt:         true,
  userId:            true,
  user: {
    select: { username: true, name: true },
  },
  cardSet: {
    select: { id: true, name: true },
  },
  checklistCard: {
    select: {
      id:            true,
      cardNumber:    true,
      playerName:    true,
      cardCategory:  true,
      cardTier:      true,
      parallel:      true,
      printRun:      true,
      variationName: true,
      team:          true,
    },
  },
} as const;

type RawAdminGel = Prisma.PortfolioCardGetPayload<{ select: typeof adminGelSelect }>;

function shapeAdminGel(pc: RawAdminGel): AdminGelEntry {
  return {
    id:                  pc.id,
    setId:               pc.cardSet.id,
    setName:             pc.cardSet.name,
    userId:              pc.userId,
    isInHand:            pc.isInHand,
    isVerified:          pc.isVerified,
    duplicateFlag:       String(pc.duplicateFlag),
    acquisitionMethod:   pc.acquisitionMethod ?? null,
    productType:         pc.productType ? String(pc.productType) : null,
    productTypeOther:    pc.productTypeOther  ?? null,
    serialNumber:        pc.serialNumber      ?? null,
    hitYear:             pc.hitYear           ?? null,
    hitMonth:            pc.hitMonth          ?? null,
    hitCity:             pc.hitCity           ?? null,
    hitCountry:          pc.hitCountry        ?? null,
    cardFrontImageUrl:   pc.cardFrontImageUrl ?? null,
    cardBackImageUrl:    pc.cardBackImageUrl  ?? null,
    seller:              pc.seller            ?? null,
    breakerName:         pc.breakerName        ?? null,
    notes:               pc.notes             ?? null,
    createdAt:           pc.createdAt.toISOString(),
    loggedByUsername:    pc.user.username ?? pc.user.name ?? "user",
    loggedByDisplayName: pc.user.name ?? null,
    checklistCard: {
      id:            pc.checklistCard.id,
      cardNumber:    pc.checklistCard.cardNumber ?? null,
      playerName:    pc.checklistCard.playerName,
      cardType:      String(pc.checklistCard.cardCategory),
      cardTier:      String(pc.checklistCard.cardTier),
      parallelType:  pc.checklistCard.parallel ?? null,
      printRun:      pc.checklistCard.printRun ?? null,
      variationName: pc.checklistCard.variationName ?? null,
      team:          pc.checklistCard.team ?? null,
    },
  };
}

export const REVIEW_QUEUE_PAGE_SIZE = 25;

export interface ReviewQueuePage {
  gels:       AdminGelEntry[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

// The Gel Review Queue's single data source — one flat, paginated
// (REVIEW_QUEUE_PAGE_SIZE per page) list, split by `status` rather than
// grouped by set (oldest-first for UNVERIFIED, newest-first for
// VERIFIED — see the orderBy below). `search` matches the card's player
// name, its card number, or the set's name (any one, case-insensitive).
export async function getReviewQueueGels(params: {
  status: "UNVERIFIED" | "VERIFIED";
  search?: string;
  page?:   number;
}): Promise<ReviewQueuePage> {
  const page   = Math.max(1, Math.floor(params.page ?? 1));
  const search = params.search?.trim();

  const where: Prisma.PortfolioCardWhereInput = {
    isVerified: params.status === "VERIFIED",
    ...(search ? {
      OR: [
        { checklistCard: { playerName: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        { checklistCard: { cardNumber: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        { cardSet:        { name:       { contains: search, mode: Prisma.QueryMode.insensitive } } },
      ],
    } : {}),
  };

  const [total, rawGels] = await Promise.all([
    prisma.portfolioCard.count({ where }),
    prisma.portfolioCard.findMany({
      where,
      // Not Verified: oldest first, so the longest-waiting submissions
      // surface at the top of the queue. Verified: newest first, so the
      // most recent decisions are what's visible without paging back.
      orderBy: { createdAt: params.status === "VERIFIED" ? "desc" : "asc" },
      skip:    (page - 1) * REVIEW_QUEUE_PAGE_SIZE,
      take:    REVIEW_QUEUE_PAGE_SIZE,
      select:  adminGelSelect,
    }),
  ]);

  return {
    gels:       rawGels.map(shapeAdminGel),
    total,
    page,
    pageSize:   REVIEW_QUEUE_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / REVIEW_QUEUE_PAGE_SIZE)),
  };
}

// How many VERIFIED gels a user needs before all their future gels
// auto-verify — see app/api/admin/gels/[gelId]/verify/route.ts.
export const AUTO_VERIFY_THRESHOLD = 5;
