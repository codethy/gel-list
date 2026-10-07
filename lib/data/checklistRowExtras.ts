// lib/data/checklistRowExtras.ts
//
// Shared logic for the "extras" layered on top of a page of ChecklistCard
// rows: real like counts/likes, real Owned/Available status, and each row's
// ownership history. Used by both lib/data/sets.ts (the server-rendered
// first page) and app/api/sets/[id]/checklist/route.ts (subsequent
// filtered/paginated fetches) so the two stay consistent and this logic
// lives in exactly one place.

import { prisma } from "@/lib/prisma";
import type { CardHistoryEvent, LoggedGel } from "@/components/set-detail/ChecklistTable";

type NameableUser = { username: string | null; name: string | null } | null;

function nameFor(user: NameableUser): { username: string; displayName: string | null } {
  if (!user) return { username: "Unknown", displayName: null };
  return { username: user.username ?? user.name ?? "user", displayName: user.name ?? null };
}

export interface ChecklistRowExtras {
  likeCount:     number;
  isLikedByUser: boolean;
  // "Owned": the canonical PortfolioCard is someone's actual in-hand copy
  // (isInHand: true). "Surfaced": every logged copy for this row is just a
  // reported sighting of someone else's gel (isInHand: false) — nobody has
  // confirmed owning it. "Available": nothing logged at all yet.
  status:        "Available" | "Owned" | "Surfaced";
  ownedGelId:    string | null;
  // The note on whichever PortfolioCard is "the" one being tracked for this
  // row — same canonical (most-recently-logged) pick as status/ownedGelId/
  // cardHistory above.
  notes:         string | null;
  cardHistory:   CardHistoryEvent[];
  // Total PortfolioCard rows logged against this checklist card — can be
  // more than 1 (e.g. two different users each logging their own numbered
  // copy), unlike ownedGelId/cardHistory above, which only ever track the
  // single most-recently-logged copy.
  gelsPulled:    number;
  // Every individual gel logged for this checklist card, each with its own
  // full history — unlike cardHistory above (only the single most-recently-
  // logged copy). Serialized copies (have a serial number) sort ascending
  // by serial number first; unserialized copies follow, sorted by when they
  // were logged.
  loggedGels:    LoggedGel[];
  // Front/back images from whichever gel was logged *first* (earliest
  // createdAt) for this checklist card — a different pick than loggedGels'
  // serialized-first sort, which is about display order, not chronology.
  imageUrl:          string | null;
  cardBackImageUrl:  string | null;
}

// Fetches likes + ownership history for a page of checklist cards, batched
// into a handful of queries scoped to just those ids (not one query per
// row), so this stays fast regardless of how many cards the set has.
export async function getChecklistRowExtras(
  cardIds: string[],
  userId:  string | null
): Promise<Map<string, ChecklistRowExtras>> {
  if (cardIds.length === 0) return new Map();

  const userSelect = { id: true, username: true, name: true } as const;

  const [likeCounts, userLikes, portfolioCards] = await Promise.all([
    prisma.checklistCardLike.groupBy({
      by:      ["checklistCardId"],
      where:   { checklistCardId: { in: cardIds } },
      orderBy: { checklistCardId: "asc" },
      _count:  { _all: true },
    }),
    // userId ?? "" (rather than branching this query's shape with a ternary)
    // keeps one consistently-typed query — see getSetDetail in
    // lib/data/sets.ts for why a ternary here previously broke
    // TypeScript's inference for a nested relation.
    prisma.checklistCardLike.findMany({
      where:  { userId: userId ?? "", checklistCardId: { in: cardIds } },
      select: { checklistCardId: true },
    }),
    prisma.portfolioCard.findMany({
      where:   { checklistCardId: { in: cardIds } },
      orderBy: { createdAt: "desc" },
      select: {
        id:                true,
        checklistCardId:   true,
        isInHand:          true,
        isVerified:        true,
        acquisitionMethod: true,
        serialNumber:      true,
        notes:             true,
        createdAt:         true,
        cardFrontImageUrl: true,
        cardBackImageUrl:  true,
        user:              { select: userSelect },
      },
    }),
  ]);

  const likeCountByCard = new Map(likeCounts.map((l) => [l.checklistCardId, l._count._all]));
  const likedCardIds    = new Set(userLikes.map((l) => l.checklistCardId));

  const gelsPulledByCard = new Map<string, number>();
  for (const pc of portfolioCards) {
    gelsPulledByCard.set(pc.checklistCardId, (gelsPulledByCard.get(pc.checklistCardId) ?? 0) + 1);
  }

  // A ChecklistCard can, in principle, have more than one PortfolioCard
  // (e.g. two different users each logging their own numbered copy, or a
  // reported sighting of someone else's). The checklist UI only has room for
  // one status/history per row, so — like ownedGelId's existing singular
  // design — we treat one PortfolioCard as "the" one being tracked for that
  // row: the most recently logged ACTUALLY-OWNED (isInHand: true) copy if
  // one exists, so a real "Owned" copy always outranks a merely-"Surfaced"
  // sighting regardless of which was logged more recently; otherwise the
  // most recently logged sighting.
  const canonicalPortfolioCardByChecklistId = new Map<string, (typeof portfolioCards)[number]>();
  for (const pc of portfolioCards) {
    const existing = canonicalPortfolioCardByChecklistId.get(pc.checklistCardId);
    if (!existing) {
      canonicalPortfolioCardByChecklistId.set(pc.checklistCardId, pc);
    } else if (!existing.isInHand && pc.isInHand) {
      canonicalPortfolioCardByChecklistId.set(pc.checklistCardId, pc);
    }
  }

  // Group every PortfolioCard (not just the canonical one) by checklist
  // card, for the "logged gels" popup — every logged copy needs its own
  // full history, since any of them can be clicked to reveal it.
  const portfolioCardsByChecklistId = new Map<string, (typeof portfolioCards)[number][]>();
  for (const pc of portfolioCards) {
    const list = portfolioCardsByChecklistId.get(pc.checklistCardId) ?? [];
    list.push(pc);
    portfolioCardsByChecklistId.set(pc.checklistCardId, list);
  }

  const allPortfolioCardIds = portfolioCards.map((pc) => pc.id);

  const transfers = await prisma.cardTransfer.findMany({
    where:   { portfolioCardId: { in: allPortfolioCardIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id:              true,
      portfolioCardId: true,
      transferDate:    true,
      notes:           true,
      createdAt:       true,
      fromUser:        { select: userSelect },
      toUser:          { select: userSelect },
    },
  });

  const transfersByPortfolioCardId = new Map<string, typeof transfers>();
  for (const t of transfers) {
    const list = transfersByPortfolioCardId.get(t.portfolioCardId) ?? [];
    list.push(t);
    transfersByPortfolioCardId.set(t.portfolioCardId, list);
  }

  function buildHistory(pc: (typeof portfolioCards)[number]): CardHistoryEvent[] {
    const cardTransfers = transfersByPortfolioCardId.get(pc.id) ?? [];
    const events: CardHistoryEvent[] = [];

    if (pc.acquisitionMethod) {
      // Whoever first held this card — the earliest transfer's sender if
      // it's since changed hands, otherwise whoever is holding it now.
      const originalHolder = cardTransfers[0]?.fromUser ?? pc.user;
      const { username, displayName } = nameFor(originalHolder);
      events.push({
        id:         `${pc.id}-acquired`,
        eventType:  pc.acquisitionMethod,
        username,
        displayName,
        occurredAt: pc.createdAt.toISOString(),
        note:       pc.notes,
      });
    }

    for (const t of cardTransfers) {
      const occurredAt = (t.transferDate ?? t.createdAt).toISOString();
      const from = nameFor(t.fromUser);
      events.push({
        id:          `${t.id}-out`,
        eventType:   "TRANSFERRED_OUT",
        username:    from.username,
        displayName: from.displayName,
        occurredAt,
        note:        t.notes,
      });
      if (t.toUser) {
        const to = nameFor(t.toUser);
        events.push({
          id:          `${t.id}-in`,
          eventType:   "TRANSFERRED_IN",
          username:    to.username,
          displayName: to.displayName,
          occurredAt,
          note:        null,
        });
      }
    }

    if (pc.isInHand) {
      const { username, displayName } = nameFor(pc.user);
      events.push({
        id:         `${pc.id}-current`,
        eventType:  "CURRENTLY_OWNS",
        username,
        displayName,
        occurredAt: null,
        note:       null,
      });
    }

    return events;
  }

  // Serialized copies (have a serial number) come first, ascending by
  // serial; unserialized copies follow, ordered by when they were logged.
  function sortLoggedGels(
    cards: (typeof portfolioCards)[number][]
  ): (typeof portfolioCards)[number][] {
    const serialized = cards
      .filter((pc) => pc.serialNumber != null)
      .sort((a, b) => a.serialNumber! - b.serialNumber!);
    const unserialized = cards
      .filter((pc) => pc.serialNumber == null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return [...serialized, ...unserialized];
  }

  // The gel logged first (earliest createdAt) for this checklist card —
  // used for the row's own thumbnail, independent of loggedGels' sort.
  function earliestLoggedGel(
    cards: (typeof portfolioCards)[number][]
  ): (typeof portfolioCards)[number] | null {
    if (cards.length === 0) return null;
    return cards.reduce((earliest, card) =>
      card.createdAt.getTime() < earliest.createdAt.getTime() ? card : earliest
    );
  }

  const extrasByCard = new Map<string, ChecklistRowExtras>();
  for (const id of cardIds) {
    const pc = canonicalPortfolioCardByChecklistId.get(id);
    const cardsForRow = portfolioCardsByChecklistId.get(id) ?? [];
    const firstLogged = earliestLoggedGel(cardsForRow);
    const loggedGels = sortLoggedGels(cardsForRow).map((card) => {
      const { username, displayName } = nameFor(card.user);
      return {
        id:                card.id,
        serialNumber:      card.serialNumber ?? null,
        loggedAt:          card.createdAt.toISOString(),
        cardFrontImageUrl: card.cardFrontImageUrl ?? null,
        cardBackImageUrl:  card.cardBackImageUrl  ?? null,
        isVerified:        card.isVerified,
        username,
        displayName,
        cardHistory:       buildHistory(card),
      };
    });

    extrasByCard.set(id, {
      likeCount:     likeCountByCard.get(id) ?? 0,
      isLikedByUser: likedCardIds.has(id),
      status:        pc ? (pc.isInHand ? "Owned" : "Surfaced") : "Available",
      ownedGelId:    pc?.id ?? null,
      notes:         pc?.notes ?? null,
      cardHistory:   pc ? buildHistory(pc) : [],
      gelsPulled:    gelsPulledByCard.get(id) ?? 0,
      loggedGels,
      imageUrl:         firstLogged?.cardFrontImageUrl ?? null,
      cardBackImageUrl: firstLogged?.cardBackImageUrl  ?? null,
    });
  }

  return extrasByCard;
}
