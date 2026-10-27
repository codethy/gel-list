// lib/data/sets.ts

import { prisma } from "@/lib/prisma";
import type { CardHistoryEvent, LoggedGel } from "@/components/set-detail/ChecklistTable";
import { getChecklistRowExtras } from "@/lib/data/checklistRowExtras";
import { getProductLabel } from "@/lib/productTypes";
import { getPacksOpenedSummary, type SetPacksOpenedSummary } from "@/lib/data/productOpenings";

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
}

// ─── MAIN FETCH FUNCTION ──────────────────────────────────────────────────────

export async function getSetDetail(
  setId:  string,
  userId: string | null
): Promise<SetDetailData | null> {

  // ── 1. Fetch the set ────────────────────────────────────────────────────
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

  const PAGE_SIZE = 50;
  const RECENT_PULLS_LIMIT = 12;

  // ── 2. Run all queries in parallel ─────────────────────────────────────
    const [
    totalCards,
    firstPageCards,
    userPortfolioCards,
    teamsRaw,
    categoriesRaw,          // ✅ NEW
    tiersRaw,               // ✅ NEW
    printRunSum,            // ✅ NEW — see step 5c below
    unlimitedPrintRunCount, // ✅ NEW
    chasesPulledInSet,      // ✅ NEW — see step 5d below
    setProducts,            // ✅ NEW
    recentPullsRaw,         // ✅ NEW
  ] = await Promise.all([

    // ── 2a. Total count ──────────────────────────────────────────────────
    prisma.checklistCard.count({
      where: { cardSetId: setId },
    }),

    // ── 2b. First page ───────────────────────────────────────────────────
    prisma.checklistCard.findMany({
      where:   { cardSetId: setId },
      skip:    0,
      take:    PAGE_SIZE,
      orderBy: { sortOrder: "asc" }, // matches the source checklist file's row order
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

    // ── 2c. User's portfolio cards ───────────────────────────────────────
    // PortfolioCard now relates to ChecklistCard (not the removed
    // CardTemplate model) — see prisma/schema.prisma.
    //
    // Always run this query with the same shape (rather than branching
    // between this call and `Promise.resolve([])` based on `userId`) — a
    // ternary here made TypeScript union the query's payload type with an
    // untyped empty array, which collapsed the nested `checklistCard`
    // relation to `never`. userId is a real cuid when signed in, so "" can
    // never match a real row — that's what makes the signed-out case a
    // no-op instead.
    // "Your Gels" only shows cards the user actually has in hand — a
    // "someone else's gel" sighting they reported (isInHand: false) still
    // counts toward that checklist row's gelsPulled/Surfaced status, but
    // doesn't belong in this user's own collection list.
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

    // ── 2e. Distinct teams ───────────────────────────────────────────────
    prisma.checklistCard.findMany({
      where:    { cardSetId: setId, team: { not: null } },
      select:   { team: true },
      distinct: ["team"],
      orderBy:  { team: "asc" },
    }),

    // ── 2f. Distinct cardCategory values for THIS set ─────────────────── ✅ NEW
    // This drives the dynamic Type filter dropdown — only categories that
    // actually exist in this set will appear as filter options.
    prisma.checklistCard.findMany({
      where:    { cardSetId: setId },
      select:   { cardCategory: true },
      distinct: ["cardCategory"],
      orderBy:  { cardCategory: "asc" },
    }),

    // ── 2f-bis. Distinct cardTier values — drives the same filter dropdown,
    // but by rarity instead of type, for TCG sets only (see
    // ChecklistTable's typeColumnLabel).
    prisma.checklistCard.findMany({
      where:    { cardSetId: setId },
      select:   { cardTier: true },
      distinct: ["cardTier"],
      orderBy:  { cardTier: "asc" },
    }),

    // ── 2g. Sum of printRun across cards that have one specified ────── ✅ NEW
    // Cards with no printRun (unlimited/unspecified — e.g. base autos or
    // case hits) are counted separately below and defaulted to 10 each,
    // rather than being included in this SQL-side SUM.
    prisma.checklistCard.aggregate({
      where: { cardSetId: setId, printRun: { not: null } },
      _sum:  { printRun: true },
    }),

    // ── 2h. Count of cards with no printRun specified ───────────────── ✅ NEW
    prisma.checklistCard.count({
      where: { cardSetId: setId, printRun: null },
    }),

    // ── 2i. "Chases Pulled" — every confirmed-real pulled copy of this ── ✅ NEW
    // set, across ALL users: an in-hand gel always counts; a reported
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

    // ── 2j. This set's admin-curated product catalog ─────────────────── ✅ NEW
    prisma.setProduct.findMany({
      where:   { cardSetId: setId },
      orderBy: { createdAt: "asc" },
      select:  { id: true, productType: true, productTypeOther: true },
    }),

    // ── 2k. "Recent Pulls" — the most recently logged gels across EVERY
    // user for this set (both own gels and "someone else's gel" reports),
    // for the feed shown above "Your Gels". Deliberately not scoped to the
    // viewer, and not filtered by isVerified — it's a live activity feed,
    // not a trust-gated stat like chasesPulledInSet.
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
  ]);

  // ── 3. Shape user gels ──────────────────────────────────────────────────
  // Output field names (cardTemplateId, cardTemplate.cardType/parallelType)
  // are kept as-is even though the data now comes from ChecklistCard, so the
  // frontend (YourGels.tsx, SetDetailClient.tsx) doesn't need to change yet.
  const userGels = userPortfolioCards.map((pc) => ({
    id:                pc.id,
    cardTemplateId:    pc.checklistCard.id,
    isInHand:          pc.isInHand,
    isVerified:        pc.isVerified,
    acquisitionMethod: pc.acquisitionMethod != null
                         ? String(pc.acquisitionMethod)
                         : null,
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

  // ── 3b. Shape "Recent Pulls" — same shape as userGels, plus who logged
  // it, across every user for this set (see 2k above).
  const recentPulls = recentPullsRaw.map((pc) => ({
    id:                pc.id,
    cardTemplateId:    pc.checklistCard.id,
    isInHand:          pc.isInHand,
    isVerified:        pc.isVerified,
    acquisitionMethod: pc.acquisitionMethod != null
                         ? String(pc.acquisitionMethod)
                         : null,
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

  // ── 4. Shape checklist rows ─────────────────────────────────────────────
  // Real likeCount/isLikedByUser/status/ownedGelId/cardHistory, via the same
  // helper app/api/sets/[id]/checklist/route.ts uses for later pages — this
  // keeps the server-rendered first page consistent with what filtering/
  // paginating fetches afterward.
  //   - imageUrl is still always null (field doesn't exist on ChecklistCard)
  //   - parallelType maps from `parallel` field
  const firstPageCardIds = firstPageCards.map((c) => c.id);
  const extrasByCard     = await getChecklistRowExtras(firstPageCardIds, userId);

  const checklistRows = firstPageCards.map((c) => {
    const extras = extrasByCard.get(c.id)!;
    return {
      id:            c.id,
      cardNumber:    c.cardNumber   ?? null,
      playerName:    c.playerName,
      team:          c.team         ?? null,
      cardType:      String(c.cardCategory),   // output as cardType for UI compatibility
      cardTier:      String(c.cardTier),       // only shown for TCG sets, as "Rarity"
      parallelType:  c.parallel     ?? null,   // ChecklistCard.parallel → parallelType
      printRun:      c.printRun     ?? null,
      variationName: c.variationName ?? null,
      // A real logged gel's own photo takes precedence; the admin-set
      // default image (ChecklistCard.imageUrl) only fills in until one exists.
      imageUrl:          extras.imageUrl ?? c.imageUrl ?? null,
      cardBackImageUrl:  extras.cardBackImageUrl,
      status:        extras.status,
      ownedGelId:    extras.ownedGelId,
      // Admin-only note (ChecklistCard.notes) — a logged gel's own note
      // only ever appears in that gel's Card History now, not here.
      notes:         c.notes ?? null,
      likeCount:     extras.likeCount,
      isLikedByUser: extras.isLikedByUser,
      gelsPulled:    extras.gelsPulled,
      cardHistory:   extras.cardHistory,
      loggedGels:    extras.loggedGels,
    };
  });

    // ── 5. Teams list ───────────────────────────────────────────────────────
  const availableTeams = teamsRaw
    .map((t) => t.team)
    .filter((t): t is string => t !== null);

  // ── 5b. Categories list ─────────────────────────────────────────────── ✅ NEW
  const availableCategories = categoriesRaw.map((c) => String(c.cardCategory));
  const availableTiers      = tiersRaw.map((t) => String(t.cardTier));

  // ── 5c. Total print run in set ────────────────────────────────────── ✅ NEW
  // "Cards in Set" on the set detail banner counts every physical copy the
  // set could ever produce — e.g. a "/10" parallel counts as 10 — rather
  // than the number of distinct checklist rows. Cards with no printRun
  // specified (unlimited base cards, case hits, etc.) default to 10 each,
  // per the same convention used for numbered cards.
  const DEFAULT_PRINT_RUN = 10;
  const totalPrintRunInSet =
    (printRunSum._sum.printRun ?? 0) + unlimitedPrintRunCount * DEFAULT_PRINT_RUN;

  // ── 5e. "X Packs/Boxes Opened" summary ──────────────────────────────────
  const packsOpened = await getPacksOpenedSummary(setId, userId);

  // ── 6. Return full payload ──────────────────────────────────────────────
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
    userGels,
    recentPulls,
    checklistRows,
    checklistMeta: {
      total:      totalCards,
      page:       1,
      pageSize:   PAGE_SIZE,
      totalPages: Math.ceil(totalCards / PAGE_SIZE),
    },
    availableTeams,
    availableCategories,   // ✅ NEW
    availableTiers,
    products: setProducts.map((p) => ({
      id:               p.id,
      productType:      String(p.productType),
      productTypeOther: p.productTypeOther,
      label:            getProductLabel(String(p.productType), p.productTypeOther),
    })),
    packsOpened,
  };
}