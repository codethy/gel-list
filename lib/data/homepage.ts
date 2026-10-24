// lib/data/homepage.ts
//
// Data layer for the home page's curated "featured sets" sections and the
// /admin/homepage curation tool that manages them, plus the
// /categories/[category] overview page (top sets per subcategory).

import { prisma } from "@/lib/prisma";
import { Category } from "@prisma/client";
import { TAXONOMY } from "@/lib/taxonomy";
import { attachPrintRunTotals } from "@/lib/data/setPrintRun";
import type { SetItem } from "@/components/SetCard";

export const MAX_FEATURED_PER_CATEGORY = 10;

const setSelect = {
  id:              true,
  name:            true,
  category:        true,
  subCategory:     true,
  year:            true,
  imageUrl:        true,
  totalHitsInSet:  true,
  totalCardsInSet: true,
} as const;

// ─── Home page: curated sections ───────────────────────────────────────────

// Up to MAX_FEATURED_PER_CATEGORY sets per category, in the admin's chosen
// order — what app/page.tsx renders by default (no filters/search active).
export async function getFeaturedSetsByCategory(): Promise<Record<string, SetItem[]>> {
  const rows = await prisma.homepageFeaturedSet.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }],
    select: { category: true, cardSet: { select: setSelect } },
  });

  const flatSets = rows.map((r) => r.cardSet);
  const withPrintRun = await attachPrintRunTotals(flatSets);
  const printRunById = new Map(withPrintRun.map((s) => [s.id, s.totalPrintRunInSet]));

  const grouped: Record<string, SetItem[]> = { SPORTS: [], ENTERTAINMENT: [], TCG: [] };
  for (const row of rows) {
    grouped[row.category].push({ ...row.cardSet, totalPrintRunInSet: printRunById.get(row.cardSet.id) ?? 0 });
  }
  return grouped;
}

// ─── Category overview page: top sets per subcategory ─────────────────────

export interface CategorySection {
  subCategoryId: string;
  label:         string;
  sets:          SetItem[];
}

export async function getCategoryOverviewSections(
  category: Category,
  perSubcategory: number = MAX_FEATURED_PER_CATEGORY
): Promise<CategorySection[]> {
  const parent = TAXONOMY.find((t) => t.enumValue === category);
  if (!parent) return [];

  const perChild = await Promise.all(
    parent.children.map((child) =>
      prisma.cardSet.findMany({
        where:   { category, subCategory: { equals: child.id, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take:    perSubcategory,
        select:  setSelect,
      })
    )
  );

  const flatSets = perChild.flat();
  const withPrintRun = await attachPrintRunTotals(flatSets);
  const printRunById = new Map(withPrintRun.map((s) => [s.id, s.totalPrintRunInSet]));

  return parent.children.map((child, i) => ({
    subCategoryId: child.id,
    label:         child.label,
    sets: perChild[i].map((s) => ({ ...s, totalPrintRunInSet: printRunById.get(s.id) ?? 0 })),
  }));
}

// ─── Admin curation (/admin/homepage) ──────────────────────────────────────

export interface FeaturedSetSummary {
  id:          string;
  name:        string;
  year:        number;
  subCategory: string;
  imageUrl:    string | null;
}

export async function getFeaturedSetsForAdmin(category: Category): Promise<FeaturedSetSummary[]> {
  const rows = await prisma.homepageFeaturedSet.findMany({
    where:   { category },
    orderBy: { order: "asc" },
    select:  { cardSet: { select: { id: true, name: true, year: true, subCategory: true, imageUrl: true } } },
  });
  return rows.map((r) => r.cardSet);
}

export async function addFeaturedSet(category: Category, cardSetId: string): Promise<{ error: string | null }> {
  const [count, cardSet] = await Promise.all([
    prisma.homepageFeaturedSet.count({ where: { category } }),
    prisma.cardSet.findUnique({ where: { id: cardSetId }, select: { category: true } }),
  ]);

  if (!cardSet) return { error: "Set not found" };
  if (cardSet.category !== category) return { error: "That set isn't in this category" };
  if (count >= MAX_FEATURED_PER_CATEGORY) {
    return { error: `Already at the ${MAX_FEATURED_PER_CATEGORY}-set limit for this category` };
  }

  try {
    await prisma.homepageFeaturedSet.create({ data: { category, cardSetId, order: count } });
    return { error: null };
  } catch {
    return { error: "That set is already featured" };
  }
}

export async function removeFeaturedSet(category: Category, cardSetId: string): Promise<void> {
  await prisma.homepageFeaturedSet.deleteMany({ where: { category, cardSetId } });
}

export async function reorderFeaturedSets(category: Category, orderedCardSetIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedCardSetIds.map((cardSetId, index) =>
      prisma.homepageFeaturedSet.update({
        where: { category_cardSetId: { category, cardSetId } },
        data:  { order: index },
      })
    )
  );
}
