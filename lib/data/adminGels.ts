// lib/data/adminGels.ts
//
// Data layer for /admin/gels — the Gel Review Queue. A single, flat,
// paginated, searchable list split into two tabs (Not Verified / Verified)
// rather than grouped by set — see components/admin/AdminGelsClient.tsx.
// Not Verified sorts oldest-first (the longest-waiting submissions surface
// first); Verified sorts newest-first (the most recent decisions are what's
// visible without paging back) — see getReviewQueueGels below.

import { prisma } from "@/lib/prisma";
import { Prisma, ProductType } from "@prisma/client";
import { PRODUCT_TYPE_OPTIONS } from "@/lib/productTypes";

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
  purchaseLocation:    string | null;
  breakerName:         string | null;
  breakerProfileId:    string | null;
  influencerHandle:    string | null;
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
  purchaseLocation:  true,
  breakerName:       true,
  breakerProfileId:  true,
  influencerHandle:  true,
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
    purchaseLocation:    pc.purchaseLocation  ?? null,
    breakerName:         pc.breakerName        ?? null,
    breakerProfileId:    pc.breakerProfileId   ?? null,
    influencerHandle:    pc.influencerHandle   ?? null,
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

// One text box per thing an admin might know about a gel, rather than one
// catch-all search bar — each is matched independently (case-insensitive
// substring, AND'd together) so e.g. setName: "2026 topps royalty tennis"
// + pulledBy: "backyard breaks" narrows to exactly that combination. All
// optional; an empty/omitted field places no constraint.
export interface AdminGelFilters {
  setName?:       string; // cardSet.name
  playerName?:    string; // checklistCard.playerName
  variationName?: string; // checklistCard.variationName
  parallel?:      string; // checklistCard.parallel
  printRun?:      string; // checklistCard.printRun — exact numeric match
  username?:      string; // the logging user's username or display name
  pulledBy?:      string; // breakerName or influencerHandle — whoever physically pulled it
  location?:      string; // hitCity or hitCountry
  product?:       string; // matched against PRODUCT_TYPE_OPTIONS labels, or productTypeOther
  purchaseLocation?: string; // "Where did you buy the product?" free text
  notes?:         string; // free text keyword search over PortfolioCard.notes
}

function stringFilter(value: string | undefined): Prisma.StringFilter | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return { contains: trimmed, mode: Prisma.QueryMode.insensitive };
}

// The Gel Review Queue's single data source — one flat, paginated
// (REVIEW_QUEUE_PAGE_SIZE per page) list, split by `status` rather than
// grouped by set (oldest-first for UNVERIFIED, newest-first for
// VERIFIED — see the orderBy below).
export async function getReviewQueueGels(params: {
  status:  "UNVERIFIED" | "VERIFIED";
  filters?: AdminGelFilters;
  page?:    number;
}): Promise<ReviewQueuePage> {
  const page    = Math.max(1, Math.floor(params.page ?? 1));
  const filters = params.filters ?? {};

  const printRunFilter = filters.printRun?.trim();
  const printRun = printRunFilter && /^\d+$/.test(printRunFilter) ? Number(printRunFilter) : undefined;

  const productSearch = filters.product?.trim();
  const matchedProductTypes = productSearch
    ? PRODUCT_TYPE_OPTIONS
        .filter((o) => o.label.toLowerCase().includes(productSearch.toLowerCase()))
        .map((o) => o.value as ProductType)
    : [];

  const and: Prisma.PortfolioCardWhereInput[] = [];

  const setNameFilter    = stringFilter(filters.setName);
  const playerNameFilter = stringFilter(filters.playerName);
  const variationFilter  = stringFilter(filters.variationName);
  const parallelFilter   = stringFilter(filters.parallel);
  const usernameFilter   = stringFilter(filters.username);
  const pulledByFilter   = stringFilter(filters.pulledBy);
  const locationFilter   = stringFilter(filters.location);
  const purchaseLocationFilter = stringFilter(filters.purchaseLocation);
  const notesFilter      = stringFilter(filters.notes);

  if (setNameFilter)    and.push({ cardSet: { name: setNameFilter } });
  if (playerNameFilter) and.push({ checklistCard: { playerName: playerNameFilter } });
  if (variationFilter)  and.push({ checklistCard: { variationName: variationFilter } });
  if (parallelFilter)   and.push({ checklistCard: { parallel: parallelFilter } });
  if (printRun !== undefined) and.push({ checklistCard: { printRun } });
  if (usernameFilter)   and.push({ user: { OR: [{ username: usernameFilter }, { name: usernameFilter }] } });
  if (pulledByFilter)   and.push({ OR: [{ breakerName: pulledByFilter }, { influencerHandle: pulledByFilter }] });
  if (locationFilter)   and.push({ OR: [{ hitCity: locationFilter }, { hitCountry: locationFilter }] });
  if (purchaseLocationFilter) and.push({ purchaseLocation: purchaseLocationFilter });
  if (notesFilter)      and.push({ notes: notesFilter });
  if (productSearch) {
    and.push({
      OR: [
        ...(matchedProductTypes.length ? [{ productType: { in: matchedProductTypes } }] : []),
        { productTypeOther: stringFilter(productSearch) },
      ],
    });
  }

  const where: Prisma.PortfolioCardWhereInput = {
    isVerified: params.status === "VERIFIED",
    ...(and.length ? { AND: and } : {}),
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

// Lightweight count for the admin home page's "Gel Review Queue" badge —
// avoids pulling a full page of gel rows just to show a number.
export async function getUnverifiedGelCount(): Promise<number> {
  return prisma.portfolioCard.count({ where: { isVerified: false } });
}
