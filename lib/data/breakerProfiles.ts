// lib/data/breakerProfiles.ts
//
// Admin-managed breaker profiles (see BreakerProfile/BreakerProductOpening
// in prisma/schema.prisma) — created so box openings attributed to a
// breaker (via the "+" opened-quantity adjustment on an admin set's
// Products table) and gels logged against them (via the searchable
// "Breaker's Name" field in Log a Gel) can be tracked accurately per
// breaker, across every set.

import { prisma } from "@/lib/prisma";
import { getProductLabel } from "@/lib/productTypes";
import { TAXONOMY } from "@/lib/taxonomy";
import { revalidateSetDetailCache } from "@/lib/data/sets";
import { Prisma } from "@prisma/client";

export interface BreakerProfileRow {
  id:                     string;
  name:                   string;
  country:                string;
  isOfficialToppsPartner: boolean;
  createdAt:              string;
}

function shapeBreakerProfile(p: {
  id: string; name: string; country: string; isOfficialToppsPartner: boolean; createdAt: Date;
}): BreakerProfileRow {
  return {
    id:                     p.id,
    name:                   p.name,
    country:                p.country,
    isOfficialToppsPartner: p.isOfficialToppsPartner,
    createdAt:              p.createdAt.toISOString(),
  };
}

export async function listBreakerProfiles(): Promise<BreakerProfileRow[]> {
  const profiles = await prisma.breakerProfile.findMany({ orderBy: { name: "asc" } });
  return profiles.map(shapeBreakerProfile);
}

export class BreakerProfileNameTakenError extends Error {
  constructor() {
    super("A breaker profile with this name already exists.");
  }
}

async function revalidateSetsForBreaker(breakerProfileId: string): Promise<void> {
  const openings = await prisma.breakerProductOpening.findMany({
    where:    { breakerProfileId },
    select:   { setProduct: { select: { cardSetId: true } } },
    distinct: ["setProductId"],
  });
  const setIds = new Set(openings.map((o) => o.setProduct.cardSetId));
  for (const setId of setIds) revalidateSetDetailCache(setId);
}

export async function createBreakerProfile(input: {
  name: string; country: string; isOfficialToppsPartner: boolean;
}): Promise<BreakerProfileRow> {
  try {
    const profile = await prisma.breakerProfile.create({ data: input });

    // Retroactively link any already-logged gel whose free-text
    // breakerName exactly matches this brand-new profile's name — only
    // happens once, at creation time (not on a later rename), and only
    // for gels not already linked to some other profile.
    await prisma.portfolioCard.updateMany({
      where:  { breakerName: profile.name, breakerProfileId: null },
      data:   { breakerProfileId: profile.id },
    });

    return shapeBreakerProfile(profile);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BreakerProfileNameTakenError();
    }
    throw error;
  }
}

export async function updateBreakerProfile(
  id: string,
  input: { name: string; country: string; isOfficialToppsPartner: boolean }
): Promise<BreakerProfileRow | null> {
  const existing = await prisma.breakerProfile.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

  try {
    const profile = await prisma.breakerProfile.update({ where: { id }, data: input });
    // A renamed breaker's label in every set's Log-a-Gel dropdown comes
    // from the cached global half of getSetDetail — invalidate every set
    // this breaker has attribution in so it doesn't lag the 180s TTL.
    await revalidateSetsForBreaker(id);
    return shapeBreakerProfile(profile);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BreakerProfileNameTakenError();
    }
    throw error;
  }
}

export async function deleteBreakerProfile(id: string): Promise<boolean> {
  const existing = await prisma.breakerProfile.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;

  // Look up affected sets BEFORE deleting — Cascade removes the
  // BreakerProductOpening rows this query would otherwise join through.
  await revalidateSetsForBreaker(id);
  await prisma.breakerProfile.delete({ where: { id } });
  return true;
}

// The set-scoped "Breaker's Name" dropdown options for Log a Gel — breakers
// with at least one attributed opening in THIS set. Mirrored inline inside
// lib/data/sets.ts's getCachedSetDetail (same query, kept there too so it
// can share that function's single Promise.all batch) — kept here as well
// for the admin set-context route (app/api/admin/sets/[id]/route.ts), which
// AdminEditGelModal reads from.
export async function getBreakerOptionsForSet(setId: string): Promise<{ id: string; name: string }[]> {
  return prisma.breakerProfile.findMany({
    where:   { productOpenings: { some: { setProduct: { cardSetId: setId } } } },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export interface BreakerBreakdown {
  categories: {
    category:      string;
    categoryLabel: string;
    subcategories: {
      subCategoryId:    string;
      subCategoryLabel: string;
      sets: {
        setId:         string;
        setName:       string;
        gelsHitCount:  number;
        oneOfOneCount: number;
        products:      { label: string; totalQuantity: number }[];
      }[];
    }[];
  }[];
}

// Nests a breaker's attributed product-openings and gels-hit counts into
// category -> subcategory -> set, using TAXONOMY as the source of truth for
// the grouping (same pattern as app/admin/page.tsx's own category ->
// subcategory -> sets listing). A set appears here if it has EITHER an
// attributed product opening OR a linked gel (e.g. purely from the
// exact-name-match backfill at profile-creation time, with no admin
// product-opening attribution) — either is enough to be worth showing.
export async function getBreakerBreakdown(breakerProfileId: string): Promise<BreakerBreakdown> {
  const [openings, gelCounts, oneOfOneCounts] = await Promise.all([
    prisma.breakerProductOpening.findMany({
      where:  { breakerProfileId },
      select: {
        quantity: true,
        setProduct: {
          select: {
            productType:      true,
            productTypeOther: true,
            cardSet: { select: { id: true, name: true, category: true, subCategory: true } },
          },
        },
      },
    }),
    prisma.portfolioCard.groupBy({
      by:     ["cardSetId"],
      where:  { breakerProfileId },
      _count: { _all: true },
    }),
    // ONE_OF_ONE is a real CardTier value — every true 1/1 card carries it
    // (see prisma/schema.prisma's CardTier enum), so this is an exact,
    // not heuristic, count.
    prisma.portfolioCard.groupBy({
      by:     ["cardSetId"],
      where:  { breakerProfileId, checklistCard: { cardTier: "ONE_OF_ONE" } },
      _count: { _all: true },
    }),
  ]);

  const gelCountBySetId = new Map(gelCounts.map((g) => [g.cardSetId, g._count._all]));
  const oneOfOneCountBySetId = new Map(oneOfOneCounts.map((g) => [g.cardSetId, g._count._all]));

  const setMap = new Map<
    string,
    { setId: string; setName: string; category: string; subCategory: string; productTotals: Map<string, number> }
  >();
  for (const o of openings) {
    const cs = o.setProduct.cardSet;
    const entry = setMap.get(cs.id) ?? {
      setId: cs.id, setName: cs.name, category: String(cs.category), subCategory: cs.subCategory,
      productTotals: new Map<string, number>(),
    };
    const label = getProductLabel(String(o.setProduct.productType), o.setProduct.productTypeOther);
    entry.productTotals.set(label, (entry.productTotals.get(label) ?? 0) + o.quantity);
    setMap.set(cs.id, entry);
  }

  // Seed entries for sets that have linked gels but no product-opening
  // attribution at all (not covered by the loop above).
  const missingSetIds = gelCounts.map((g) => g.cardSetId).filter((id) => !setMap.has(id));
  if (missingSetIds.length > 0) {
    const missingSets = await prisma.cardSet.findMany({
      where:  { id: { in: missingSetIds } },
      select: { id: true, name: true, category: true, subCategory: true },
    });
    for (const cs of missingSets) {
      setMap.set(cs.id, {
        setId: cs.id, setName: cs.name, category: String(cs.category), subCategory: cs.subCategory,
        productTotals: new Map<string, number>(),
      });
    }
  }

  return {
    categories: TAXONOMY.map((parent) => ({
      category:      parent.enumValue,
      categoryLabel: parent.label,
      subcategories: parent.children
        .map((child) => ({
          subCategoryId:    child.id,
          subCategoryLabel: child.label,
          sets: [...setMap.values()]
            .filter((s) => s.category === parent.enumValue && s.subCategory.toUpperCase() === child.id)
            .map((s) => ({
              setId:         s.setId,
              setName:       s.setName,
              gelsHitCount:  gelCountBySetId.get(s.setId) ?? 0,
              oneOfOneCount: oneOfOneCountBySetId.get(s.setId) ?? 0,
              products: [...s.productTotals.entries()]
                .map(([label, totalQuantity]) => ({ label, totalQuantity }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            })),
        }))
        .filter((sub) => sub.sets.length > 0),
    })).filter((cat) => cat.subcategories.length > 0),
  };
}
