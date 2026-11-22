// lib/data/purchaseLocations.ts
//
// Per-set "Where did you buy the product?" option list (SetPurchaseLocation
// in prisma/schema.prisma) — unlike SetProduct this isn't empty by default:
// the first time a set's list is needed, ensureDefaultPurchaseLocations
// seeds it with a brand-dependent base list, plus retail-chain options if
// the set's product catalog already has a trigger product type. After that
// one-time seed, only the admin's own add/remove actions change it — this
// function never re-syncs an already-seeded set, so an admin removal sticks.

import { prisma } from "@/lib/prisma";

export const DEFAULT_PURCHASE_LOCATIONS = ["LCS", "Online Retailers", "Card Show", "eBay", "Others"];

export const TOPPS_PURCHASE_LOCATIONS = [
  "Topps.com (Pre-order)",
  "Topps.com (Launch)",
  "Fanatics website",
  "Fanatics store",
  "LCS",
  "Online Retailers",
  "Card Show",
  "eBay",
  "Others",
];

// Product types that, once added to a set's catalog, imply the set was
// sold at general retail — triggers seeding the retail-chain options below.
export const RETAIL_TRIGGER_PRODUCT_TYPES = [
  "BLASTER_BOX",
  "HANGER_BOX",
  "MEGA_BOX",
  "FAT_PACK",
  "HANGER_PACK",
  "SLEEVED_PACK",
];

export const RETAIL_CHAIN_PURCHASE_LOCATIONS = ["Walmart", "Target", "Other Retail Chains"];

// Seeds a set's purchase-location list the first time it's needed. No-ops
// once any row already exists for this set (an empty list after the admin
// removed every option is indistinguishable from "never seeded" — in
// practice this only matters for a set with zero options left, which is a
// rare, admin-chosen state).
export async function ensureDefaultPurchaseLocations(cardSetId: string): Promise<void> {
  const existingCount = await prisma.setPurchaseLocation.count({ where: { cardSetId } });
  if (existingCount > 0) return;

  const cardSet = await prisma.cardSet.findUnique({ where: { id: cardSetId }, select: { brand: true } });
  if (!cardSet) return;

  const base = cardSet.brand.trim().toLowerCase() === "topps" ? TOPPS_PURCHASE_LOCATIONS : DEFAULT_PURCHASE_LOCATIONS;

  const retailTriggerCount = await prisma.setProduct.count({
    where: { cardSetId, productType: { in: RETAIL_TRIGGER_PRODUCT_TYPES as never[] } },
  });
  const labels = retailTriggerCount > 0 ? [...base, ...RETAIL_CHAIN_PURCHASE_LOCATIONS] : base;

  await prisma.setPurchaseLocation.createMany({
    data: labels.map((label) => ({ cardSetId, label })),
    skipDuplicates: true,
  });
}

export interface PurchaseLocationRow {
  id:    string;
  label: string;
}

export async function listPurchaseLocations(cardSetId: string): Promise<PurchaseLocationRow[]> {
  await ensureDefaultPurchaseLocations(cardSetId);
  return prisma.setPurchaseLocation.findMany({
    where:   { cardSetId },
    orderBy: { createdAt: "asc" },
    select:  { id: true, label: true },
  });
}

// Called right after the admin adds a product to a set's catalog (see
// app/api/admin/sets/[id]/products/route.ts) — reactive, not a one-time
// snapshot, so adding a trigger product later still adds these options.
export async function addRetailChainLocationsIfTriggered(cardSetId: string, productType: string): Promise<void> {
  if (!RETAIL_TRIGGER_PRODUCT_TYPES.includes(productType)) return;
  await prisma.setPurchaseLocation.createMany({
    data: RETAIL_CHAIN_PURCHASE_LOCATIONS.map((label) => ({ cardSetId, label })),
    skipDuplicates: true,
  });
}
