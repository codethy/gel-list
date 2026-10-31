// lib/data/sets.ts

import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CardHistoryEvent, LoggedGel } from "@/components/set-detail/ChecklistTable";
import { getChecklistRowExtras } from "@/lib/data/checklistRowExtras";
import { getProductLabel } from "@/lib/productTypes";
import {
  getPacksOpenedGlobal,
  getUserPacksOpenedOwn,
  type GlobalPacksOpenedSummary,
  type SetPacksOpenedSummary,
} from "@/lib/data/productOpenings";
import { getUserGelDefaults } from "@/lib/data/userGelDefaults";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SetDetailData {
  setId:                string;
  setName:              string;
  category:             string; // "SPORTS" | "ENTERTAINMENT" | "TCG"
  subCategory:          string;
  year:                 number;
  brand:                string;
  totalCardsInSet:      number;
  totalPrintRunInSet:   number;
  // Every confirmed-real pulled copy of this set, across ALL users — an
  // in-hand gel always counts; a "someone else's gel" sighting only counts
  // once the developer has verified it (see /admin/gels). Distinct from
  // userGels.length, which is just the current viewer's own collection.
  chasesPulledInSet:    number;
  totalChaseCardsInSet: number | null;
  imageUrl:             string | null;

  userGels: {
    id:                string;
    cardTemplateId:    string;
    isInHand:          boolean;
    isVerified:        boolean;
    acquisitionMethod: string | null;
    serialNumber:      number | null;
    hitYear:           number | null;
    hitMonth:          number | null;
    hitCity:           string | null;
    hitCountry:        string | null;
    cardFrontImageUrl: string | null;
    cardBackImageUrl:  string | null;
    seller:            string | null;
    notes:             string | null;
    productType:       string | null;
    productTypeOther:  string | null;
    cardTemplate: {
      playerName:    string;
      cardType:      string;
      parallelType:  string | null;
      printRun:      number | null;
      variationName: string | null;
      team:          string | null;
    };
  }[];

  // Most recently logged gels across every user for this set — shown in
  // the "Recent Pulls" feed above "Your Gels". Same shape as userGels plus
  // who logged it.
  recentPulls: {
    id:                string;
    cardTemplateId:    string;
    isInHand:          boolean;
    isVerified:        boolean;
    acquisitionMethod: string | null;
    serialNumber:      number | null;
    hitYear:           number | null;
    hitMonth:          number | null;
    hitCity:           string | null;
    hitCountry:        string | null;
    cardFrontImageUrl: string | null;
    cardBackImageUrl:  string | null;
    seller:            string | null;
    notes:             string | null;
    productType:       string | null;
    productTypeOther:  string | null;
    loggedByName:      string;
    loggedByHandle:    string | null;
    cardTemplate: {
      playerName:    string;
      cardType:      string;
      parallelType:  string | null;
      printRun:      number | null;
      variationName: string | null;
      team:          string | null;
    };
  }[];

  checklistRows: {
    id:            string;
    cardNumber:    string | null;
    playerName:    string;
    team:          string | null;
    cardType:      string;
    cardTier:      string;
    parallelType:  string | null;
    printRun:      number | null;
    variationName: string | null;
    imageUrl:      string | null;
    cardBackImageUrl: string | null;
    status:        "Available" | "Owned" | "Surfaced";
    ownedGelId:    string | null;
    notes:         string | null;
    likeCount:     number;
    isLikedByUser: boolean;
    gelsPulled:    number;
    cardHistory:   CardHistoryEvent[];
    loggedGels:    LoggedGel[];
    variantCount:  number;
  }[];

  checklistMeta: {
    total:      number;
    page:       number;
    pageSize:   number;
    totalPages: number;
  };

  availableTeams: string[];
  availableCategories:  string[];   // ✅ NEW — distinct CardCategory values for this set
  availableTiers:       string[];   // distinct CardTier values — TCG sets' "Rarity" filter

  // Admin-curated product catalog for this set (see SetProduct in
  // prisma/schema.prisma) — powers the "Which Product" dropdown in the Log
  // a Gel form, enabled only when "How did you get it?" is "Pulled".
  products: {
    id:               string;
    productType:      string;
    productTypeOther: string | null;
    label:            string;
  }[];

  // "X Packs/Boxes Opened" box + its breakdown/log modals — see
  // lib/data/productOpenings.ts.
  packsOpened: SetPacksOpenedSummary;

  // Pre-fills the "Log a Gel" form's City/Country fields (SELF flow only)
  // from this user's own most recent submission — see
  // lib/data/userGelDefaults.ts. Both null when signed out or never set.
  userLastGelCity:    string | null;
  userLastGelCountry: string | null;
}

// ─── CACHING ──────────────────────────────────────────────────────────────────
// getSetDetail is split into a cached "global" half (identical for every
// viewer of a given set — set metadata, the checklist, products, etc.) and
// a handful of small live per-viewer queries merged on top (userGels,
// recentPulls, isLikedByUser, packsOpened's own* fields, the remembered
// City/Country defaults). The split exists because the global half's
// checklist-grouping scan reads every ChecklistCard row in the set (up to
// ~19,864 for the largest set in this app) — identical work for every
// single viewer, yet it used to re-run on every single page load. See
// lib/data/homepage.ts for the same unstable_cache/revalidateTag
// convention this mirrors (180s safety-net TTL, immediate-expiry tag
// invalidation) — tags are computed per-setId here (unlike homepage.ts's
// fixed single-tag caches) by constructing the unstable_cache call fresh
// inside getCachedSetDetail on every invocation, the pattern Next's own
// unstable_cache docs use for exactly this per-entity-id case.

const SET_DETAIL_CACHE_REVALIDATE_SECONDS = 180;

function setDetailTag(setId: string): string {
  return `set-detail-${setId}`;
}

// Call after any mutation that changes a set's checklist rows, products,
// pack kinds, or own metadata (name/category/etc) — every admin/gels/likes/
// openings route that touches this set's data needs this.
export function revalidateSetDetailCache(setId: string): void {
  revalidateTag(setDetailTag(setId), { expire: 0 });
}

type CachedChecklistRow = Omit<SetDetailData["checklistRows"][number], "isLikedByUser">;

interface CachedSetDetail {
  setId:                string;
  setName:              string;
  category:             string;
  subCategory:          string;
  year:                 number;
  brand:                string;
  totalCardsInSet:      number;
  totalPrintRunInSet:   number;
  chasesPulledInSet:    number;
  totalChaseCardsInSet: number | null;
  imageUrl:             string | null;
  checklistRows:        CachedChecklistRow[];
  checklistMeta:        SetDetailData["checklistMeta"];
  availableTeams:       string[];
  availableCategories:  string[];
  availableTiers:       string[];
  products:             SetDetailData["products"];
  packsOpenedGlobal:    GlobalPacksOpenedSummary;
}

const PAGE_SIZE = 50;

async function getCachedSetDetail(setId: string): Promise<CachedSetDetail | null> {
  return unstable_cache(
    async (setId: string): Promise<CachedSetDetail | null> => {
      // ── 1. Fetch the set ────────────────────────────────────────────────
      const cardSet = await prisma.cardSet.findUnique({
        where:  { id: setId },
        select: {
          id:                   true,
          name:                 true,
          category:             true,
          subCategory:          true,
          year:                 true,
          brand:                true,
          totalCardsInSet:      true,
          totalChaseCardsInSet: true,
          imageUrl:             true,
        },
      });

      if (!cardSet) return null;

      // ── 1b. Group checklist rows by cardNumber for the first page — see
      // the identical logic (and rationale) in
      // app/api/sets/[id]/checklist/route.ts. knownPrintRunSum (sum of
      // every variant's *known* printRun) plus nullPrintRunCardIds
      // (variants with no fixed printRun, e.g. a card's unnumbered "base"
      // version) together power the Gels column's combined "owned/print
      // run" fraction.
      const idsForGrouping = await prisma.checklistCard.findMany({
        where:   { cardSetId: setId },
        orderBy: { sortOrder: "asc" },
        select:  { id: true, cardNumber: true, printRun: true },
      });

      const groupOrder: string[] = [];
      const groupsByCardNumber = new Map<
        string,
        { representativeId: string; cardIds: string[]; variantCount: number; knownPrintRunSum: number; nullPrintRunCardIds: string[] }
      >();
      for (const { id, cardNumber, printRun } of idsForGrouping) {
        const existing = groupsByCardNumber.get(cardNumber);
        const group = existing ?? {
          representativeId: id,
          cardIds: [] as string[],
          variantCount: 0,
          knownPrintRunSum: 0,
          nullPrintRunCardIds: [] as string[],
        };
        group.variantCount += 1;
        group.cardIds.push(id);
        if (printRun != null) {
          group.knownPrintRunSum += printRun;
        } else {
          group.nullPrintRunCardIds.push(id);
        }
        if (!existing) {
          groupsByCardNumber.set(cardNumber, group);
          groupOrder.push(cardNumber);
        }
      }

      const totalCardGroups = groupOrder.length;
      const firstPageCardNumbers = groupOrder.slice(0, PAGE_SIZE);
      const firstPageGroups = firstPageCardNumbers.map((cn) => groupsByCardNumber.get(cn)!);
      const variantCountByRepId = new Map(firstPageGroups.map((g) => [g.representativeId, g.variantCount] as const));
      const firstPageRepresentativeIds = firstPageGroups.map((g) => g.representativeId);

      // Combined gels-logged count across every variant in each group — a
      // gel logged against any one parallel counts toward its base card's
      // total. A variant with no fixed printRun contributes its own
      // logged-gel count instead of 0 — see the identical rationale in
      // app/api/sets/[id]/checklist/route.ts (the SO-BS Ben Shelton Solus
      // example).
      const firstPageAllVariantIds = firstPageGroups.flatMap((g) => g.cardIds);
      const firstPageGelsCounts = await prisma.portfolioCard.groupBy({
        by:     ["checklistCardId"],
        where:  { checklistCardId: { in: firstPageAllVariantIds } },
        _count: { _all: true },
      });
      const firstPageGelsCountByCardId = new Map(firstPageGelsCounts.map((g) => [g.checklistCardId, g._count._all]));
      const totalGelsPulledByRepId = new Map(
        firstPageGroups.map((g) => [
          g.representativeId,
          g.cardIds.reduce((sum, id) => sum + (firstPageGelsCountByCardId.get(id) ?? 0), 0),
        ] as const)
      );
      const totalPrintRunByRepId = new Map(
        firstPageGroups.map((g) => [
          g.representativeId,
          g.knownPrintRunSum + g.nullPrintRunCardIds.reduce((sum, id) => sum + (firstPageGelsCountByCardId.get(id) ?? 0), 0),
        ] as const)
      );

      // ── 2. Run all global (viewer-independent) queries in parallel ──────
      const [
        firstPageCardsUnordered,
        teamsRaw,
        categoriesRaw,
        tiersRaw,
        printRunSum,
        unlimitedPrintRunCount,
        chasesPulledInSet,
        setProducts,
      ] = await Promise.all([
        // First page — just this page's representative (grouped) cards,
        // fetched by id (see 1b above for how they were chosen) rather
        // than a plain offset query.
        prisma.checklistCard.findMany({
          where:  { id: { in: firstPageRepresentativeIds } },
          select: {
            id:            true,
            cardNumber:    true,
            playerName:    true,
            team:          true,
            cardCategory:  true,
            cardTier:      true,
            parallel:      true,
            printRun:      true,
            variationName: true,
            isHit:         true,
            imageUrl:      true,
            notes:         true,
          },
        }),

        // Distinct teams
        prisma.checklistCard.findMany({
          where:    { cardSetId: setId, team: { not: null } },
          select:   { team: true },
          distinct: ["team"],
          orderBy:  { team: "asc" },
        }),

        // Distinct cardCategory values for THIS set — drives the dynamic
        // Type filter dropdown.
        prisma.checklistCard.findMany({
          where:    { cardSetId: setId },
          select:   { cardCategory: true },
          distinct: ["cardCategory"],
          orderBy:  { cardCategory: "asc" },
        }),

        // Distinct cardTier values — same filter dropdown, but by rarity
        // instead of type, for TCG sets only.
        prisma.checklistCard.findMany({
          where:    { cardSetId: setId },
          select:   { cardTier: true },
          distinct: ["cardTier"],
          orderBy:  { cardTier: "asc" },
        }),

        // Sum of printRun across cards that have one specified. Cards
        // with no printRun (unlimited/unspecified) are counted separately
        // below and defaulted to 10 each.
        prisma.checklistCard.aggregate({
          where: { cardSetId: setId, printRun: { not: null } },
          _sum:  { printRun: true },
        }),

        // Count of cards with no printRun specified
        prisma.checklistCard.count({
          where: { cardSetId: setId, printRun: null },
        }),

        // "Chases Pulled" — every confirmed-real pulled copy of this set,
        // across ALL users: an in-hand gel always counts; a reported
        // sighting of someone else's gel only counts once verified.
        prisma.portfolioCard.count({
          where: {
            cardSetId: setId,
            OR: [
              { isInHand: true },
              { isInHand: false, isVerified: true },
            ],
          },
        }),

        // This set's admin-curated product catalog
        prisma.setProduct.findMany({
          where:   { cardSetId: setId },
          orderBy: { createdAt: "asc" },
          select:  { id: true, productType: true, productTypeOther: true },
        }),
      ]);

      // ── 3. Shape checklist rows ──────────────────────────────────────────
      // likeCount/status/ownedGelId/cardHistory/gelsPulled/loggedGels are
      // all global (no userId filter inside getChecklistRowExtras) — passed
      // null here since isLikedByUser (the one per-viewer field it also
      // returns) isn't part of this cached shape; getSetDetail overlays the
      // real per-viewer value afterward. Same helper
      // app/api/sets/[id]/checklist/route.ts uses for later pages.
      const firstPageCardsById = new Map(firstPageCardsUnordered.map((c) => [c.id, c]));
      const extrasByCard = await getChecklistRowExtras(firstPageRepresentativeIds, null);

      const checklistRows: CachedChecklistRow[] = firstPageRepresentativeIds.map((id) => {
        const c      = firstPageCardsById.get(id)!;
        const extras = extrasByCard.get(id)!;
        return {
          id:            c.id,
          cardNumber:    c.cardNumber   ?? null,
          playerName:    c.playerName,
          team:          c.team         ?? null,
          cardType:      String(c.cardCategory),
          cardTier:      String(c.cardTier),
          parallelType:  c.parallel     ?? null,
          // The Gels column shows combined totals across every
          // parallel/variant of this base card.
          printRun:      totalPrintRunByRepId.get(id) || null,
          variationName: c.variationName ?? null,
          // A real logged gel's own photo takes precedence; the admin-set
          // default image only fills in until one exists.
          imageUrl:          extras.imageUrl ?? c.imageUrl ?? null,
          cardBackImageUrl:  extras.cardBackImageUrl,
          status:        extras.status,
          ownedGelId:    extras.ownedGelId,
          notes:         c.notes ?? null,
          likeCount:     extras.likeCount,
          gelsPulled:    totalGelsPulledByRepId.get(id) ?? extras.gelsPulled,
          cardHistory:   extras.cardHistory,
          loggedGels:    extras.loggedGels,
          variantCount:  variantCountByRepId.get(id) ?? 1,
        };
      });

      // ── 4. Teams/categories/tiers lists ──────────────────────────────────
      const availableTeams = teamsRaw
        .map((t) => t.team)
        .filter((t): t is string => t !== null);
      const availableCategories = categoriesRaw.map((c) => String(c.cardCategory));
      const availableTiers      = tiersRaw.map((t) => String(t.cardTier));

      // ── 5. Total print run in set ────────────────────────────────────────
      // "Cards in Set" on the set detail banner counts every physical copy
      // the set could ever produce — e.g. a "/10" parallel counts as 10 —
      // rather than the number of distinct checklist rows. Cards with no
      // printRun specified default to 10 each.
      const DEFAULT_PRINT_RUN = 10;
      const totalPrintRunInSet =
        (printRunSum._sum.printRun ?? 0) + unlimitedPrintRunCount * DEFAULT_PRINT_RUN;

      // ── 6. "X Packs/Boxes Opened" — global half only ─────────────────────
      const packsOpenedGlobal = await getPacksOpenedGlobal(setId);

      return {
        setId:                cardSet.id,
        setName:              cardSet.name,
        category:             String(cardSet.category),
        subCategory:          cardSet.subCategory,
        year:                 cardSet.year,
        brand:                cardSet.brand,
        totalCardsInSet:      cardSet.totalCardsInSet,
        totalPrintRunInSet,
        chasesPulledInSet,
        totalChaseCardsInSet: cardSet.totalChaseCardsInSet ?? null,
        imageUrl:             cardSet.imageUrl             ?? null,
        checklistRows,
        checklistMeta: {
          total:      totalCardGroups,
          page:       1,
          pageSize:   PAGE_SIZE,
          totalPages: Math.ceil(totalCardGroups / PAGE_SIZE),
        },
        availableTeams,
        availableCategories,
        availableTiers,
        products: setProducts.map((p) => ({
          id:               p.id,
          productType:      String(p.productType),
          productTypeOther: p.productTypeOther,
          label:            getProductLabel(String(p.productType), p.productTypeOther),
        })),
        packsOpenedGlobal,
      };
    },
    ["set-detail", setId],
    { tags: [setDetailTag(setId)], revalidate: SET_DETAIL_CACHE_REVALIDATE_SECONDS }
  )(setId);
}

// ─── MAIN FETCH FUNCTION ──────────────────────────────────────────────────────
// Same external signature/return shape as before this file was split for
// caching — callers (app/sets/[id]/page.tsx) need no changes.

const RECENT_PULLS_LIMIT = 12;

export async function getSetDetail(
  setId:  string,
  userId: string | null
): Promise<SetDetailData | null> {
  const cached = await getCachedSetDetail(setId);
  if (!cached) return null;

  const representativeIds = cached.checklistRows.map((r) => r.id);

  const [
    userPortfolioCards,
    recentPullsRaw,
    userLikes,
    ownPacksOpened,
    userGelDefaults,
  ] = await Promise.all([
    // PortfolioCard relates to ChecklistCard directly. Always run this
    // query with the same shape (rather than branching to a plain `[]`
    // based on userId) — a ternary here made TypeScript union the query's
    // payload type with an untyped empty array, collapsing the nested
    // checklistCard relation to `never`. userId is a real cuid when
    // signed in, so "" can never match a real row — that's what makes the
    // signed-out case a no-op instead.
    // "Your Gels" only shows cards the user actually has in hand — a
    // "someone else's gel" sighting they reported still counts toward
    // that row's gelsPulled/Surfaced status, but doesn't belong here.
    prisma.portfolioCard.findMany({
      where:   { userId: userId ?? "", cardSetId: setId, isInHand: true },
      orderBy: { createdAt: "desc" },
      select: {
        id:                true,
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
      },
    }),

    // "Recent Pulls" — deliberately never cached (see the type above):
    // it's a live activity feed, identical for every viewer but the most
    // time-sensitive field in the whole payload, and cheap (take: 12) —
    // caching it would make "recent" visibly lag reality.
    prisma.portfolioCard.findMany({
      where:   { cardSetId: setId },
      orderBy: { createdAt: "desc" },
      take:    RECENT_PULLS_LIMIT,
      select: {
        id:                true,
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
        user: { select: { name: true, username: true, handle: true } },
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
      },
    }),

    // This viewer's own likes among the current page's representative
    // rows — the one per-viewer field getChecklistRowExtras otherwise
    // returns; same userId-can-never-be-"" trick as above.
    prisma.checklistCardLike.findMany({
      where:  { userId: userId ?? "", checklistCardId: { in: representativeIds } },
      select: { checklistCardId: true },
    }),

    getUserPacksOpenedOwn(setId, userId),

    userId ? getUserGelDefaults(userId) : Promise.resolve({ lastGelCity: null, lastGelCountry: null }),
  ]);

  // ── Shape user gels ────────────────────────────────────────────────────
  const userGels = userPortfolioCards.map((pc) => ({
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
    cardTemplate: {
      playerName:    pc.checklistCard.playerName,
      cardType:      String(pc.checklistCard.cardCategory),
      parallelType:  pc.checklistCard.parallel ?? null,
      printRun:      pc.checklistCard.printRun ?? null,
      variationName: pc.checklistCard.variationName ?? null,
      team:          pc.checklistCard.team     ?? null,
    },
  }));

  // ── Shape "Recent Pulls" ───────────────────────────────────────────────
  const recentPulls = recentPullsRaw.map((pc) => ({
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
    loggedByName:      pc.user.name ?? pc.user.username ?? "A user",
    loggedByHandle:    pc.user.handle ?? null,
    cardTemplate: {
      playerName:    pc.checklistCard.playerName,
      cardType:      String(pc.checklistCard.cardCategory),
      parallelType:  pc.checklistCard.parallel ?? null,
      printRun:      pc.checklistCard.printRun ?? null,
      variationName: pc.checklistCard.variationName ?? null,
      team:          pc.checklistCard.team     ?? null,
    },
  }));

  // ── Overlay this viewer's likes onto the cached global rows ───────────
  const likedIds = new Set(userLikes.map((l) => l.checklistCardId));
  const checklistRows = cached.checklistRows.map((row) => ({
    ...row,
    isLikedByUser: likedIds.has(row.id),
  }));

  // ── Merge packsOpened's global + per-viewer halves ─────────────────────
  const packsOpened: SetPacksOpenedSummary = {
    totalPacksOpened: cached.packsOpenedGlobal.totalPacksOpened,
    label:            cached.packsOpenedGlobal.label,
    totalCardsPulled: cached.packsOpenedGlobal.totalCardsPulled,
    ownTotalPacksOpened: ownPacksOpened.ownTotalPacksOpened,
    products: cached.packsOpenedGlobal.products.map((p) => ({
      ...p,
      ownQuantity: ownPacksOpened.ownByProductId.get(p.setProductId)?.ownQuantity ?? 0,
      ownIsBreak:  ownPacksOpened.ownByProductId.get(p.setProductId)?.ownIsBreak  ?? false,
    })),
  };

  return {
    setId:                cached.setId,
    setName:              cached.setName,
    category:             cached.category,
    subCategory:          cached.subCategory,
    year:                 cached.year,
    brand:                cached.brand,
    totalCardsInSet:      cached.totalCardsInSet,
    totalPrintRunInSet:   cached.totalPrintRunInSet,
    chasesPulledInSet:    cached.chasesPulledInSet,
    totalChaseCardsInSet: cached.totalChaseCardsInSet,
    imageUrl:             cached.imageUrl,
    userGels,
    recentPulls,
    checklistRows,
    checklistMeta:        cached.checklistMeta,
    availableTeams:       cached.availableTeams,
    availableCategories:  cached.availableCategories,
    availableTiers:       cached.availableTiers,
    products:             cached.products,
    packsOpened,
    userLastGelCity:    userGelDefaults.lastGelCity,
    userLastGelCountry: userGelDefaults.lastGelCountry,
  };
}
