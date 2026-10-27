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
}

export async function getPacksOpenedSummary(
  setId: string,
  userId: string | null
): Promise<SetPacksOpenedSummary> {
  const products = await prisma.setProduct.findMany({
    where:   { cardSetId: setId },
    orderBy: { createdAt: "asc" },
    select: {
      id:               true,
      productType:      true,
      productTypeOther: true,
      packKinds:        { select: { packsCount: true } },
    },
  });

  if (products.length === 0) {
    return { totalPacksOpened: 0, label: "Packs Opened", products: [], ownTotalPacksOpened: 0 };
  }

  const productIds = products.map((p) => p.id);

  const [totals, own] = await Promise.all([
    prisma.productOpening.groupBy({
      by:     ["setProductId"],
      where:  { setProductId: { in: productIds } },
      _sum:   { quantity: true },
    }),
    userId
      ? prisma.productOpening.findMany({
          where:  { userId, setProductId: { in: productIds } },
          select: { setProductId: true, quantity: true, isBreak: true },
        })
      : Promise.resolve([]),
  ]);

  const totalByProduct = new Map(totals.map((t) => [t.setProductId, t._sum.quantity ?? 0]));
  const ownByProduct   = new Map(own.map((o) => [o.setProductId, o]));

  const productRows: ProductBreakdownRow[] = products.map((p) => {
    const packsPerUnit = p.packKinds.length > 0
      ? p.packKinds.reduce((sum, k) => sum + k.packsCount, 0)
      : 1;
    const label = getProductLabel(String(p.productType), p.productTypeOther);
    const ownEntry = ownByProduct.get(p.id);

    return {
      setProductId:  p.id,
      label,
      pluralLabel:   pluralizeProductLabel(label),
      packsPerUnit,
      totalQuantity: totalByProduct.get(p.id) ?? 0,
      ownQuantity:   ownEntry?.quantity ?? 0,
      ownIsBreak:    ownEntry?.isBreak ?? false,
    };
  });

  const totalPacksOpened    = productRows.reduce((sum, p) => sum + p.totalQuantity * p.packsPerUnit, 0);
  const ownTotalPacksOpened = productRows.reduce((sum, p) => sum + p.ownQuantity * p.packsPerUnit, 0);

  const isSingleBoxSet = productRows.length === 1 && productRows[0].packsPerUnit === 1;

  return {
    totalPacksOpened,
    label: isSingleBoxSet ? "Boxes Opened" : "Packs Opened",
    products: productRows,
    ownTotalPacksOpened,
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
