// lib/data/adminGels.ts
//
// Data layer for /admin/gels — every logged gel across the whole platform,
// grouped by set and then by "My Own Gel" vs "Someone Else's Gel"
// (PortfolioCard.isInHand), each in reverse-chronological order (newest
// first), so the developer always sees the newest pending submissions at
// the top of each group.

import { prisma } from "@/lib/prisma";

export interface AdminGelEntry {
  id:                 string;
  isInHand:           boolean;
  isVerified:         boolean;
  acquisitionMethod:  string | null;
  serialNumber:       number | null;
  hitYear:            number | null;
  hitMonth:           number | null;
  hitCity:            string | null;
  hitCountry:         string | null;
  cardFrontImageUrl:  string | null;
  cardBackImageUrl:   string | null;
  seller:             string | null;
  notes:              string | null;
  createdAt:          string;
  loggedByUsername:   string;
  loggedByDisplayName: string | null;
  checklistCard: {
    id:            string;
    playerName:    string;
    cardType:      string;
    parallelType:  string | null;
    printRun:      number | null;
    variationName: string | null;
    team:          string | null;
  };
}

export interface AdminSetGroup {
  setId:     string;
  setName:   string;
  ownGels:   AdminGelEntry[];
  otherGels: AdminGelEntry[];
}

export async function getAllLoggedGelsGrouped(): Promise<AdminSetGroup[]> {
  const portfolioCards = await prisma.portfolioCard.findMany({
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
      createdAt:         true,
      user: {
        select: { username: true, name: true },
      },
      cardSet: {
        select: { id: true, name: true },
      },
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
  });

  // portfolioCards is already sorted newest-first, so building this map in
  // iteration order naturally orders the groups themselves by whichever set
  // most recently had a gel logged — and each group's ownGels/otherGels
  // arrays, built by filtering in the same order, stay newest-first too.
  const groupsBySetId = new Map<string, AdminSetGroup>();

  for (const pc of portfolioCards) {
    let group = groupsBySetId.get(pc.cardSet.id);
    if (!group) {
      group = { setId: pc.cardSet.id, setName: pc.cardSet.name, ownGels: [], otherGels: [] };
      groupsBySetId.set(pc.cardSet.id, group);
    }

    const entry: AdminGelEntry = {
      id:                  pc.id,
      isInHand:            pc.isInHand,
      isVerified:          pc.isVerified,
      acquisitionMethod:   pc.acquisitionMethod ?? null,
      serialNumber:        pc.serialNumber      ?? null,
      hitYear:             pc.hitYear           ?? null,
      hitMonth:            pc.hitMonth          ?? null,
      hitCity:             pc.hitCity           ?? null,
      hitCountry:          pc.hitCountry        ?? null,
      cardFrontImageUrl:   pc.cardFrontImageUrl ?? null,
      cardBackImageUrl:    pc.cardBackImageUrl  ?? null,
      seller:              pc.seller            ?? null,
      notes:               pc.notes             ?? null,
      createdAt:           pc.createdAt.toISOString(),
      loggedByUsername:    pc.user.username ?? pc.user.name ?? "user",
      loggedByDisplayName: pc.user.name ?? null,
      checklistCard: {
        id:            pc.checklistCard.id,
        playerName:    pc.checklistCard.playerName,
        cardType:      String(pc.checklistCard.cardCategory),
        parallelType:  pc.checklistCard.parallel ?? null,
        printRun:      pc.checklistCard.printRun ?? null,
        variationName: pc.checklistCard.variationName ?? null,
        team:          pc.checklistCard.team ?? null,
      },
    };

    if (pc.isInHand) {
      group.ownGels.push(entry);
    } else {
      group.otherGels.push(entry);
    }
  }

  return [...groupsBySetId.values()];
}

// How many VERIFIED gels a user needs before all their future gels
// auto-verify — see app/api/admin/gels/[gelId]/verify/route.ts.
export const AUTO_VERIFY_THRESHOLD = 5;
