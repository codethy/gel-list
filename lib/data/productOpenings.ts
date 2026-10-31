// lib/data/productOpenings.ts
//
// Data layer for the set page's "X Packs Opened" box, its "See full
// breakdown" modal, and the "Log it here" self-report form — see
// ProductOpening and ProductPackKind in prisma/schema.prisma.
//
// Every user logs, per set, how many of each catalog product (Hobby Box,
// Booster Pack, etc.) they personally opened — one row per (user,
// product), not one row per box. A product's "packs-per-unit" (how many
// packs one box/unit actually contains) comes from its ProductPackKind
// rows, admin-managed on /admin/sets/[id]/checklist — see
// AdminProductPacksModal.tsx. A product with no pack kinds configured yet
// defaults to 1 pack per unit, so the total is still meaningful (and the
// set's "Boxes Opened" vs. "Packs Opened" label still resolves sensibly)
// before an admin has filled that data in.

import { prisma } from "@/lib/prisma";
import { getProductLabel, pluralizeProductLabel } from "@/lib/productTypes";

export interface ProductBreakdownRow {
  setProductId: string;
  label:        string; // "Hobby Box"
  pluralLabel:  string; // "Hobby Boxes"
  packsPerUnit: number;
  totalQuantity: number; // every user's logged quantity, summed
  ownQuantity:   number; // the viewing user's own logged quantity (0 if none/signed out)
  ownIsBreak:    boolean;
}

export interface SetPacksOpenedSummary {
  totalPacksOpened:    number;
  // "Boxes Opened" only when this set has exactly one product and that
  // product is itself just one pack (box == pack, no meaningful
  // distinction) — otherwise "Packs Opened".
  label:               "Packs Opened" | "Boxes Opened";
  products:            ProductBreakdownRow[];
  ownTotalPacksOpened: number;
  // Every pack's own cardsPerPack multiplied through — shown as the
  // "Cards Pulled" box next to "Packs Opened" in the breakdown modal. A
  // product with no pack kinds configured yet contributes 0 here (unlike
  // packsPerUnit's "default to 1 pack" convention, there's no sensible
  // default for how many cards a pack of unknown size contains).
  totalCardsPulled:    number;
}

// Everything in this result is identical for every viewer of the set — no
// userId involved anywhere — which is what makes it safe for
// lib/data/sets.ts to wrap in unstable_cache. Each product row's
// own-viewer fields (ownQuantity/ownIsBreak) are deliberately absent here;
// see getUserPacksOpenedOwn below for those.
export type GlobalProductBreakdownRow = Omit<ProductBreakdownRow, "ownQuantity" | "ownIsBreak">;

export interface GlobalPacksOpenedSummary {
  totalPacksOpened: number;
  label:            "Packs Opened" | "Boxes Opened";
  products:         GlobalProductBreakdownRow[];
  totalCardsPulled: number;
}

export async function getPacksOpenedGlobal(setId: string): Promise<GlobalPacksOpenedSummary> {
  const products = await prisma.setProduct.findMany({
    where:   { cardSetId: setId },
    orderBy: { createdAt: "asc" },
    select: {
      id:               true,
      productType:      true,
      productTypeOther: true,
      packKinds:        { select: { packsCount: true, cardsPerPack: true } },
    },
  });

  if (products.length === 0) {
    return { totalPacksOpened: 0, label: "Packs Opened", products: [], totalCardsPulled: 0 };
  }

  const productIds = products.map((p) => p.id);

  const totals = await prisma.productOpening.groupBy({
    by:    ["setProductId"],
    where: { setProductId: { in: productIds } },
    _sum:  { quantity: true },
  });

  const totalByProduct = new Map(totals.map((t) => [t.setProductId, t._sum.quantity ?? 0]));

  // A product's pack kinds can mix pack sizes (e.g. a box with both a
  // 4-card-per-pack kind and a 6-card-per-pack kind) — cardsPerUnit sums
  // each kind's own packsCount * cardsPerPack, not packsPerUnit times one
  // shared cardsPerPack.
  const cardsPerUnitByProductId = new Map(
    products.map((p) => [
      p.id,
      p.packKinds.reduce((sum, k) => sum + k.packsCount * k.cardsPerPack, 0),
    ])
  );

  const productRows: GlobalProductBreakdownRow[] = products.map((p) => {
    const packsPerUnit = p.packKinds.length > 0
      ? p.packKinds.reduce((sum, k) => sum + k.packsCount, 0)
      : 1;
    const label = getProductLabel(String(p.productType), p.productTypeOther);

    return {
      setProductId:  p.id,
      label,
      pluralLabel:   pluralizeProductLabel(label),
      packsPerUnit,
      totalQuantity: totalByProduct.get(p.id) ?? 0,
    };
  });

  const totalPacksOpened = productRows.reduce((sum, p) => sum + p.totalQuantity * p.packsPerUnit, 0);
  const totalCardsPulled = productRows.reduce(
    (sum, p) => sum + p.totalQuantity * (cardsPerUnitByProductId.get(p.setProductId) ?? 0),
    0
  );

  const isSingleBoxSet = productRows.length === 1 && productRows[0].packsPerUnit === 1;

  return {
    totalPacksOpened,
    label: isSingleBoxSet ? "Boxes Opened" : "Packs Opened",
    products: productRows,
    totalCardsPulled,
  };
}

export interface UserPacksOpenedOwn {
  ownByProductId:      Map<string, { ownQuantity: number; ownIsBreak: boolean }>;
  ownTotalPacksOpened: number;
}

// The small per-viewer slice of the breakdown — deliberately independent
// of getPacksOpenedGlobal (re-fetches the tiny product/pack-kind catalog
// itself rather than requiring it be threaded in) so the two stay
// separately callable: the global half is cacheable, this half never is.
export async function getUserPacksOpenedOwn(
  setId: string,
  userId: string | null
): Promise<UserPacksOpenedOwn> {
  if (!userId) return { ownByProductId: new Map(), ownTotalPacksOpened: 0 };

  const products = await prisma.setProduct.findMany({
    where:  { cardSetId: setId },
    select: { id: true, packKinds: { select: { packsCount: true } } },
  });
  if (products.length === 0) return { ownByProductId: new Map(), ownTotalPacksOpened: 0 };

  const packsPerUnitByProductId = new Map(
    products.map((p) => [
      p.id,
      p.packKinds.length > 0 ? p.packKinds.reduce((sum, k) => sum + k.packsCount, 0) : 1,
    ])
  );

  const own = await prisma.productOpening.findMany({
    where:  { userId, setProductId: { in: products.map((p) => p.id) } },
    select: { setProductId: true, quantity: true, isBreak: true },
  });

  const ownByProductId = new Map(
    own.map((o) => [o.setProductId, { ownQuantity: o.quantity, ownIsBreak: o.isBreak }])
  );
  const ownTotalPacksOpened = own.reduce(
    (sum, o) => sum + o.quantity * (packsPerUnitByProductId.get(o.setProductId) ?? 1),
    0
  );

  return { ownByProductId, ownTotalPacksOpened };
}

// Thin wrapper composing the two halves above into the full shape every
// existing caller (the "Log it here" openings route) already expects — no
// changes needed at those call sites.
export async function getPacksOpenedSummary(
  setId: string,
  userId: string | null
): Promise<SetPacksOpenedSummary> {
  const [global, own] = await Promise.all([
    getPacksOpenedGlobal(setId),
    getUserPacksOpenedOwn(setId, userId),
  ]);

  return {
    totalPacksOpened: global.totalPacksOpened,
    label:            global.label,
    totalCardsPulled: global.totalCardsPulled,
    ownTotalPacksOpened: own.ownTotalPacksOpened,
    products: global.products.map((p) => ({
      ...p,
      ownQuantity: own.ownByProductId.get(p.setProductId)?.ownQuantity ?? 0,
      ownIsBreak:  own.ownByProductId.get(p.setProductId)?.ownIsBreak  ?? false,
    })),
  };
}

// Upserts the signed-in user's logged quantity for one product (deletes
// the row instead if the new quantity is 0 — no point keeping a zeroed-out
// log entry around).
export async function saveProductOpening(
  userId: string,
  cardSetId: string,
  setProductId: string,
  quantity: number,
  isBreak: boolean
): Promise<void> {
  if (quantity <= 0) {
    await prisma.productOpening.deleteMany({ where: { userId, setProductId } });
    return;
  }

  await prisma.productOpening.upsert({
    where:  { userId_setProductId: { userId, setProductId } },
    create: { userId, cardSetId, setProductId, quantity, isBreak },
    update: { quantity, isBreak },
  });
}

// This user's "Packs Opened" total across EVERY set — the profile page's
// stat box equivalent of a single set's totalPacksOpened. Each
// ProductOpening.quantity is in units of that product (e.g. "3 Hobby
// Boxes"), not packs, so this still has to multiply through each product's
// own packsPerUnit (from its ProductPackKind rows) rather than just
// summing quantity directly — same convention as getPacksOpenedSummary.
export async function getUserTotalPacksOpened(userId: string): Promise<number> {
  const openings = await prisma.productOpening.findMany({
    where:  { userId },
    select: {
      quantity:   true,
      setProduct: { select: { packKinds: { select: { packsCount: true } } } },
    },
  });

  return openings.reduce((sum, o) => {
    const packsPerUnit = o.setProduct.packKinds.length > 0
      ? o.setProduct.packKinds.reduce((s, k) => s + k.packsCount, 0)
      : 1;
    return sum + o.quantity * packsPerUnit;
  }, 0);
}
