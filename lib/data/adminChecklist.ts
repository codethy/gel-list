// lib/data/adminChecklist.ts
//
// Data layer for the admin checklist-correction tool at
// /admin/sets/[id]/checklist — lets the developer add, edit, or delete
// individual ChecklistCard rows after a set has already been imported,
// to fix spreadsheet mistakes (a wrong parallel, a missing row, a typo)
// without having to delete and re-run the whole import.

import { prisma } from "@/lib/prisma";
import { CardCategory, CardTier } from "@prisma/client";
import { getProductLabel } from "@/lib/productTypes";

export interface AdminChecklistSet {
  id:        string;
  name:      string;
  year:      number;
  brand:     string;
  category:  string;
  cardCount: number;
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
}

export interface AdminProductRow {
  id:               string;
  productType:      string;
  productTypeOther: string | null;
  label:            string;
}

export interface AdminChecklistSetDetail {
  set:      { id: string; name: string; year: number; brand: string; category: string };
  cards:    AdminChecklistCard[];
  products: AdminProductRow[];
}

// Every set, newest first, for the /admin/sets picker page.
export async function getAdminChecklistSets(): Promise<AdminChecklistSet[]> {
  const sets = await prisma.cardSet.findMany({
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: {
      id:       true,
      name:     true,
      year:     true,
      brand:    true,
      category: true,
      _count:   { select: { checklistCards: true } },
    },
  });

  return sets.map((s) => ({
    id:        s.id,
    name:      s.name,
    year:      s.year,
    brand:     s.brand,
    category:  String(s.category),
    cardCount: s._count.checklistCards,
  }));
}

// One set's full checklist, in display order, for the edit table.
export async function getAdminChecklistForSet(setId: string): Promise<AdminChecklistSetDetail | null> {
  const cardSet = await prisma.cardSet.findUnique({
    where:  { id: setId },
    select: { id: true, name: true, year: true, brand: true, category: true },
  });
  if (!cardSet) return null;

  const cards = await prisma.checklistCard.findMany({
    where:   { cardSetId: setId },
    orderBy: { sortOrder: "asc" },
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
      sortOrder:     true,
    },
  });

  const products = await prisma.setProduct.findMany({
    where:   { cardSetId: setId },
    orderBy: { createdAt: "asc" },
    select:  { id: true, productType: true, productTypeOther: true },
  });

  return {
    set: {
      id:       cardSet.id,
      name:     cardSet.name,
      year:     cardSet.year,
      brand:    cardSet.brand,
      category: String(cardSet.category),
    },
    cards: cards.map((c) => ({
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
    })),
    products: products.map((p) => ({
      id:               p.id,
      productType:      String(p.productType),
      productTypeOther: p.productTypeOther,
      label:            getProductLabel(String(p.productType), p.productTypeOther),
    })),
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
    },
  };
}
