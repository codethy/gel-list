// lib/data/sets.ts

import { prisma } from "@/lib/prisma";
import type { CardHistoryEvent } from "@/components/set-detail/ChecklistTable";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SetDetailData {
  setId:                string;
  setName:              string;
  subCategory:          string;
  year:                 number;
  brand:                string;
  totalCardsInSet:      number;
  totalChaseCardsInSet: number | null;
  imageUrl:             string | null;

  userGels: {
    id:                string;
    cardTemplateId:    string;
    acquisitionMethod: string | null;
    serialNumber:      number | null;
    hitYear:           number | null;
    hitMonth:          number | null;
    hitCity:           string | null;
    hitCountry:        string | null;
    cardFrontImageUrl: string | null;
    cardBackImageUrl:  string | null;
    seller:            string | null;
    notes:             null;
    cardTemplate: {
      playerName:   string;
      cardType:     string;
      parallelType: string | null;
      printRun:     number | null;
      team:         string | null;
    };
  }[];

  checklistRows: {
    id:            string;
    cardNumber:    string | null;
    playerName:    string;
    team:          string | null;
    cardType:      string;
    parallelType:  string | null;
    printRun:      number | null;
    imageUrl:      string | null;
    status:        "Available" | "Owned" | "Surfaced";
    ownedGelId:    string | null;
    notes:         string | null;
    likeCount:     number;
    isLikedByUser: boolean;
    cardHistory: {
      id:          string;
      eventType:   CardHistoryEvent["eventType"];
      username:    string;
      displayName: string | null;
      occurredAt:  string | null;
      note:        string | null;
    }[];
  }[];

  checklistMeta: {
    total:      number;
    page:       number;
    pageSize:   number;
    totalPages: number;
  };

  allTemplates: {
    id:           string;
    playerName:   string;
    cardType:     string;
    parallelType: string | null;
    printRun:     number | null;
    team:         string | null;
  }[];

  availableTeams: string[];
  availableCategories:  string[];   // ✅ NEW — distinct CardCategory values for this set
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

  // ── 2. Run all queries in parallel ─────────────────────────────────────
    const [
    totalCards,
    firstPageCards,
    userPortfolioCards,
    allChecklistCards,
    teamsRaw,
    categoriesRaw,          // ✅ NEW
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
      orderBy: [{ playerName: "asc" }, { cardCategory: "asc" }],
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
        isChase:       true,
      },
    }),

    // ── 2c. User's portfolio cards ───────────────────────────────────────
    userId
      ? prisma.portfolioCard.findMany({
          where:   { userId, cardSetId: setId },
          orderBy: { createdAt: "desc" },
          select: {
            id:                true,
            acquisitionMethod: true,
            serialNumber:      true,
            hitYear:           true,
            hitMonth:          true,
            hitCity:           true,
            hitCountry:        true,
            cardFrontImageUrl: true,
            cardBackImageUrl:  true,
            seller:            true,
            cardTemplate: {
              select: {
                id:           true,
                playerName:   true,
                cardCategory: true,
                parallelType: true,
                printRun:     true,
                team:         true,
              },
            },
          },
        })
      : Promise.resolve([]),

    // ── 2d. All checklist cards for Add Gel modal ────────────────────────
    prisma.checklistCard.findMany({
      where:   { cardSetId: setId },
      orderBy: [{ playerName: "asc" }],
      select: {
        id:           true,
        playerName:   true,
        cardCategory: true,
        parallel:     true,
        printRun:     true,
        team:         true,
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
  ]);

  // ── 3. Shape user gels ──────────────────────────────────────────────────
  const userGels = userPortfolioCards.map((pc) => ({
    id:                pc.id,
    cardTemplateId:    pc.cardTemplate.id,
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
    notes:             null as null,
    cardTemplate: {
      playerName:   pc.cardTemplate.playerName,
      cardType:     String(pc.cardTemplate.cardCategory),
      parallelType: pc.cardTemplate.parallelType ?? null,
      printRun:     pc.cardTemplate.printRun     ?? null,
      team:         pc.cardTemplate.team         ?? null,
    },
  }));

  // ── 4. Shape checklist rows ─────────────────────────────────────────────
  // ChecklistCard has no user-relation data yet, so:
  //   - status is always "Available"
  //   - likeCount is always 0
  //   - isLikedByUser is always false
  //   - cardHistory is always []
  //   - imageUrl is always null (field doesn't exist on ChecklistCard)
  //   - parallelType maps from `parallel` field
  const checklistRows = firstPageCards.map((c) => ({
    id:            c.id,
    cardNumber:    c.cardNumber   ?? null,
    playerName:    c.playerName,
    team:          c.team         ?? null,
    cardType:      String(c.cardCategory),   // output as cardType for UI compatibility
    parallelType:  c.parallel     ?? null,   // ChecklistCard.parallel → parallelType
    printRun:      c.printRun     ?? null,
    imageUrl:      null,                     // ChecklistCard has no imageUrl yet
    status:        "Available" as const,     // No user relations on ChecklistCard yet
    ownedGelId:    null,
    notes:         null,
    likeCount:     0,
    isLikedByUser: false,
    cardHistory:   [] as SetDetailData["checklistRows"][number]["cardHistory"],
  }));

    // ── 5. Teams list ───────────────────────────────────────────────────────
  const availableTeams = teamsRaw
    .map((t) => t.team)
    .filter((t): t is string => t !== null);

  // ── 5b. Categories list ─────────────────────────────────────────────── ✅ NEW
  const availableCategories = categoriesRaw.map((c) => String(c.cardCategory));

  // ── 6. Return full payload ──────────────────────────────────────────────
  return {
    setId:                cardSet.id,
    setName:              cardSet.name,
    subCategory:          cardSet.subCategory,
    year:                 cardSet.year,
    brand:                cardSet.brand,
    totalCardsInSet:      cardSet.totalCardsInSet,
    totalChaseCardsInSet: cardSet.totalChaseCardsInSet ?? null,
    imageUrl:             cardSet.imageUrl             ?? null,
    userGels,
    checklistRows,
    checklistMeta: {
      total:      totalCards,
      page:       1,
      pageSize:   PAGE_SIZE,
      totalPages: Math.ceil(totalCards / PAGE_SIZE),
    },
    allTemplates: allChecklistCards.map((c) => ({
      id:           c.id,
      playerName:   c.playerName,
      cardType:     String(c.cardCategory),
      parallelType: c.parallel ?? null,
      printRun:     c.printRun ?? null,
      team:         c.team     ?? null,
    })),
    availableTeams,
    availableCategories,   // ✅ NEW
  };
