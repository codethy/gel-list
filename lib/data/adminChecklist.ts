// lib/data/adminChecklist.ts
//
// Data layer for the admin checklist-correction tool at
// /admin/sets/[id]/checklist — lets the developer add, edit, or delete
// individual ChecklistCard rows after a set has already been imported,
// to fix spreadsheet mistakes (a wrong parallel, a missing row, a typo)
// without having to delete and re-run the whole import.

import { prisma } from "@/lib/prisma";
import { CardCategory, CardTier, Prisma } from "@prisma/client";
import { getProductLabel } from "@/lib/productTypes";
import { findMatchingChecklistCardIds } from "@/lib/data/checklistSearch";

export interface AdminChecklistSet {
  id:          string;
  name:        string;
  year:        number;
  brand:       string;
  category:    string;
  subCategory: string;
  cardCount:   number;
}

export interface AdminChecklistCard {
  id:            string;
  cardNumber:    string;
  playerName:    string;
  team:          string | null;
  cardCategory:  string;
  cardTier:      string;
  parallel:      string | null;
  printRun:      number | null;
  variationName: string | null;
  isHit:         boolean;
  sortOrder:     number;
  imageUrl:      string | null;
  notes:         string | null;
}

export interface AdminPackKind {
  id:           string;
  packsCount:   number;
  cardsPerPack: number;
}

export interface AdminProductRow {
  id:               string;
  productType:      string;
  productTypeOther: string | null;
  label:            string;
  packKinds:        AdminPackKind[];
  // Sum of every pack kind's packsCount — 0 means no pack kinds have been
  // configured yet (treated as 1 pack per unit elsewhere, for the "X
  // Packs/Boxes Opened" calculation — see lib/data/productOpenings.ts).
  packsPerUnit:     number;
}

export interface AdminChecklistMeta {
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

export interface AdminChecklistCardsPage {
  cards: AdminChecklistCard[];
  meta:  AdminChecklistMeta;
}

export interface AdminChecklistSetDetail {
  set: {
    id:          string;
    name:        string;
    year:        number;
    brand:       string;
    category:    string;
    subCategory: string;
    description: string | null;
  };
  cardsPage: AdminChecklistCardsPage;
  products:  AdminProductRow[];
}

// Every set, newest first, for the /admin/sets picker page.
export async function getAdminChecklistSets(): Promise<AdminChecklistSet[]> {
  const sets = await prisma.cardSet.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: {
      id:          true,
      name:        true,
      year:        true,
      brand:       true,
      category:    true,
      subCategory: true,
      _count:      { select: { checklistCards: true } },
    },
  });

  return sets.map((s) => ({
    id:          s.id,
    name:        s.name,
    year:        s.year,
    brand:       s.brand,
    category:    String(s.category),
    subCategory: s.subCategory,
    cardCount:   s._count.checklistCards,
  }));
}

// One set's first page of checklist rows (see getAdminChecklistCardsPage
// below), for the edit table's initial server render.
export async function getAdminChecklistForSet(setId: string): Promise<AdminChecklistSetDetail | null> {
  const cardSet = await prisma.cardSet.findUnique({
    where:  { id: setId },
    select: { id: true, name: true, year: true, brand: true, category: true, subCategory: true, description: true },
  });
  if (!cardSet) return null;

  const cardsPage = await getAdminChecklistCardsPage(setId, {});
  const products = await getAdminProducts(setId);

  return {
    set: {
      id:          cardSet.id,
      name:        cardSet.name,
      year:        cardSet.year,
      brand:       cardSet.brand,
      category:    String(cardSet.category),
      subCategory: cardSet.subCategory,
      description: cardSet.description,
    },
    cardsPage,
    products,
  };
}

// Recomputes and persists CardSet.totalCardsInSet — the one cached total
// that can go stale once rows are added/removed outside of the original
// bulk import (everything else the set page shows is computed live).
export async function syncTotalCardsInSet(setId: string): Promise<void> {
  const cardCount = await prisma.checklistCard.count({ where: { cardSetId: setId } });
  await prisma.cardSet.update({ where: { id: setId }, data: { totalCardsInSet: cardCount } });
}

// How many other records point at this ChecklistCard — PortfolioCard is the
// only one ever actually written to by the app today (CardTransfer and
// UnverifiedHit exist in the schema but nothing currently creates rows in
// them), but all three share a required, non-cascading foreign key to
// ChecklistCard, so any of them would block a raw DELETE. Checked this way,
// at delete-time for one specific row, rather than precomputed for the whole
// list, since it only matters when someone actually tries to delete.
export async function countChecklistCardReferences(checklistCardId: string): Promise<number> {
  const [portfolioCards, transfers, unverifiedHits] = await Promise.all([
    prisma.portfolioCard.count({ where: { checklistCardId } }),
    prisma.cardTransfer.count({ where: { checklistCardId } }),
    prisma.unverifiedHit.count({ where: { checklistCardId } }),
  ]);
  return portfolioCards + transfers + unverifiedHits;
}

export const VALID_CARD_CATEGORIES = Object.values(CardCategory);
export const VALID_CARD_TIERS      = Object.values(CardTier);

export interface ChecklistCardInput {
  cardNumber:    string;
  playerName:    string;
  team:          string | null;
  cardCategory:  CardCategory;
  cardTier:      CardTier;
  parallel:      string | null;
  printRun:      number | null;
  variationName: string | null;
  isHit:         boolean;
  notes:         string | null;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// Shared by both the add (POST) and edit (PATCH) admin checklist routes —
// same required fields and enum validation the bulk importer uses, so a
// hand-added or hand-corrected row can never end up in a shape the importer
// itself would have rejected.
export function parseChecklistCardInput(
  body: any
): { data: ChecklistCardInput; error?: undefined } | { data?: undefined; error: string } {
  const cardNumber = typeof body?.cardNumber === "string" ? body.cardNumber.trim() : "";
  if (!cardNumber) return { error: "Card number is required" };

  const playerName = typeof body?.playerName === "string" ? body.playerName.trim() : "";
  if (!playerName) return { error: "Player/character name is required" };

  if (!VALID_CARD_CATEGORIES.includes(body?.cardCategory)) {
    return { error: `"${body?.cardCategory}" is not a valid card category` };
  }
  if (!VALID_CARD_TIERS.includes(body?.cardTier)) {
    return { error: `"${body?.cardTier}" is not a valid card tier` };
  }

  let printRun: number | null = null;
  if (body?.printRun !== null && body?.printRun !== undefined && body?.printRun !== "") {
    const parsed = Number(body.printRun);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { error: "Print run must be a positive number, or left blank" };
    }
    printRun = Math.round(parsed);
  }

  return {
    data: {
      cardNumber,
      playerName,
      team:          parseOptionalString(body?.team),
      cardCategory:  body.cardCategory,
      cardTier:      body.cardTier,
      parallel:      parseOptionalString(body?.parallel),
      printRun,
      variationName: parseOptionalString(body?.variationName),
      isHit:         Boolean(body?.isHit),
      notes:         parseOptionalString(body?.notes),
    },
  };
}

// ─── CHECKLIST CARD POSITIONING ────────────────────────────────────────────
// Lets the admin place a card above/below another card it's searched for,
// instead of always landing at the end of the checklist — see
// AdminChecklistCardModal.tsx.

export interface PositionInstruction {
  anchorCardId: string;
  where:        "above" | "below";
}

// Parses the optional `position` field on a create/edit request body.
// Returns { data: null } (not an error) when the field is simply absent —
// positioning is optional, so most requests won't include it at all.
export function parsePositionInstruction(
  body: any
): { data: PositionInstruction | null; error?: undefined } | { data?: undefined; error: string } {
  if (body?.position == null) return { data: null };

  const anchorCardId = typeof body.position.anchorCardId === "string" ? body.position.anchorCardId : "";
  if (!anchorCardId) return { error: "position.anchorCardId is required" };

  const where = body.position.where;
  if (where !== "above" && where !== "below") {
    return { error: 'position.where must be "above" or "below"' };
  }

  return { data: { anchorCardId, where } };
}

// Moves one card to sit directly above/below another, renumbering every
// row in the set to its new 0-based index. Simpler and more robust than
// trying to shift only the rows in between, especially since historical
// deletes can leave gaps in the stored sortOrder values.
//
// Written as a single bulk UPDATE...FROM(VALUES...) statement rather than
// one Prisma update per row: a $transaction([...]) of N sequential updates
// used to do this, which for a set of any real size (hundreds+ rows) could
// take longer than Prisma's default 5-second transaction timeout — the
// request would fail (reported to the admin as a generic save error) after
// already having rolled back every update, leaving the card unrepositioned.
// One statement means one round trip regardless of how many rows move.
export async function repositionChecklistCard(
  setId: string,
  cardId: string,
  instruction: PositionInstruction
): Promise<{ error: string | null }> {
  const cards = await prisma.checklistCard.findMany({
    where:   { cardSetId: setId },
    orderBy: { sortOrder: "asc" },
    select:  { id: true },
  });

  const others = cards.map((c) => c.id).filter((id) => id !== cardId);
  const anchorIndex = others.indexOf(instruction.anchorCardId);
  if (anchorIndex === -1) {
    return { error: "The selected reference card was not found in this set" };
  }

  const insertIndex = instruction.where === "above" ? anchorIndex : anchorIndex + 1;
  const newOrder = [...others.slice(0, insertIndex), cardId, ...others.slice(insertIndex)];

  const values = Prisma.join(
    newOrder.map((id, index) => Prisma.sql`(${id}::text, ${index}::int)`),
    ", "
  );

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "ChecklistCard" AS c
    SET "sortOrder" = v.pos
    FROM (VALUES ${values}) AS v(id, pos)
    WHERE c.id = v.id
  `);

  return { error: null };
}

const ADMIN_CHECKLIST_CARD_SELECT = {
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
  sortOrder:     true,
  imageUrl:      true,
  notes:         true,
} as const;

type RawAdminChecklistCard = Prisma.ChecklistCardGetPayload<{ select: typeof ADMIN_CHECKLIST_CARD_SELECT }>;

function toAdminChecklistCard(c: RawAdminChecklistCard): AdminChecklistCard {
  return {
    id:            c.id,
    cardNumber:    c.cardNumber,
    playerName:    c.playerName,
    team:          c.team,
    cardCategory:  String(c.cardCategory),
    cardTier:      String(c.cardTier),
    parallel:      c.parallel,
    printRun:      c.printRun,
    variationName: c.variationName,
    isHit:         c.isHit,
    sortOrder:     c.sortOrder,
    imageUrl:      c.imageUrl,
    notes:         c.notes,
  };
}

// Single-row shaping for the create/edit API routes, which only need to
// hand back the one row they just changed, not the whole set.
export function shapeAdminChecklistCard(c: RawAdminChecklistCard): AdminChecklistCard {
  return toAdminChecklistCard(c);
}

export const adminChecklistCardSelect = ADMIN_CHECKLIST_CARD_SELECT;

// One page of a set's checklist, in display order, optionally narrowed by
// the same player/card-number/parallel/etc. search used elsewhere (see
// lib/data/checklistSearch.ts). Replaces an earlier version that fetched
// every ChecklistCard row for the set unconditionally — fine for a small
// set, but a real set here has up to ~19,864 rows, all of which used to be
// re-fetched and sent to the browser after adding or editing even one row.
export async function getAdminChecklistCardsPage(
  setId: string,
  { page = 1, pageSize = 50, search = "" }: { page?: number; pageSize?: number; search?: string }
): Promise<AdminChecklistCardsPage> {
  const clampedPageSize = Math.min(100, Math.max(1, pageSize));
  const clampedPage     = Math.max(1, page);
  const skip            = (clampedPage - 1) * clampedPageSize;

  const searchMatchedIds = await findMatchingChecklistCardIds(setId, search);
  const where: Prisma.ChecklistCardWhereInput = {
    cardSetId: setId,
    ...(searchMatchedIds !== null ? { id: { in: searchMatchedIds } } : {}),
  };

  const [total, cards] = await Promise.all([
    prisma.checklistCard.count({ where }),
    prisma.checklistCard.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      skip,
      take:    clampedPageSize,
      select:  ADMIN_CHECKLIST_CARD_SELECT,
    }),
  ]);

  return {
    cards: cards.map(toAdminChecklistCard),
    meta: {
      total,
      page:       clampedPage,
      pageSize:   clampedPageSize,
      totalPages: Math.ceil(total / clampedPageSize),
    },
  };
}

// Re-fetches one set's product catalog, including each product's pack
// kinds — used after an add/remove/pack-kind edit so the client can just
// replace its whole list.
export async function getAdminProducts(setId: string): Promise<AdminProductRow[]> {
  const products = await prisma.setProduct.findMany({
    where:   { cardSetId: setId },
    orderBy: { createdAt: "asc" },
    select: {
      id:               true,
      productType:      true,
      productTypeOther: true,
      packKinds: {
        orderBy: { sortOrder: "asc" },
        select:  { id: true, packsCount: true, cardsPerPack: true },
      },
    },
  });

  return products.map((p) => ({
    id:               p.id,
    productType:      String(p.productType),
    productTypeOther: p.productTypeOther,
    label:            getProductLabel(String(p.productType), p.productTypeOther),
    packKinds:        p.packKinds,
    packsPerUnit:     p.packKinds.reduce((sum, k) => sum + k.packsCount, 0),
  }));
}
