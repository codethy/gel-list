// lib/data/eqlTracker.ts
//
// Admin-curated EQL ("early-qualification-list" / raffle-style product
// drop) tracker — see EqlSet/EqlProduct/EqlResult in prisma/schema.prisma.
// Admin enrolls a CardSet and defines its options (EqlProduct); any
// visitor, signed in or not, can self-report a result (EqlResult) for one
// of those options. One EqlResult row always counts as 1 toward its set's
// success/fail total, regardless of the quantity it recorded.

import { prisma } from "@/lib/prisma";
import { getProductLabel } from "@/lib/productTypes";
import { Prisma, ProductType } from "@prisma/client";

export interface EqlProductInput {
  id?: string; // present only when editing an existing row
  productType: string;
  productTypeOther: string | null;
  maxQuantity: number;
  estimatedPrintRun: number | null;
  // How many boxes one unit of this option is worth — only meaningful
  // (and required, validated at the API layer) when productType is
  // "CASE"; always stored as null for every other product type.
  boxesPerCase: number | null;
}

export interface EqlProductRow {
  id: string;
  label: string;
  maxQuantity: number;
  estimatedPrintRun: number | null;
  boxesPerCase: number | null;
}

export interface EqlSetListRow {
  id: string;
  cardSetId: string;
  setName: string;
  setImageUrl: string | null;
  productCount: number;
}

function shapeProduct(p: {
  id: string;
  productType: string;
  productTypeOther: string | null;
  maxQuantity: number;
  estimatedPrintRun: number | null;
  boxesPerCase: number | null;
}): EqlProductRow {
  return {
    id: p.id,
    label: getProductLabel(p.productType, p.productTypeOther),
    maxQuantity: p.maxQuantity,
    estimatedPrintRun: p.estimatedPrintRun,
    boxesPerCase: p.boxesPerCase,
  };
}

// Server-authoritative: boxesPerCase only ever applies to CASE options —
// any value sent for a different product type is discarded.
function normalizeBoxesPerCase(productType: string, boxesPerCase: number | null): number | null {
  return productType === "CASE" ? boxesPerCase : null;
}

// Every enrolled set — powers both the admin list (name + option count)
// and the public list (name only; the public page trims the payload
// itself before rendering, per the "only list out the name" requirement).
export async function listEqlSets(): Promise<EqlSetListRow[]> {
  const sets = await prisma.eqlSet.findMany({
    orderBy: { cardSet: { name: "asc" } },
    select: {
      id: true,
      cardSetId: true,
      cardSet: { select: { name: true, imageUrl: true } },
      _count: { select: { products: true } },
    },
  });
  return sets.map((s) => ({
    id: s.id,
    cardSetId: s.cardSetId,
    setName: s.cardSet.name,
    setImageUrl: s.cardSet.imageUrl,
    productCount: s._count.products,
  }));
}

export class EqlSetAlreadyExistsError extends Error {
  constructor() {
    super("This set already has an EQL drop enrolled.");
  }
}

export async function createEqlSet(
  cardSetId: string,
  products: EqlProductInput[]
): Promise<EqlSetListRow> {
  try {
    const created = await prisma.eqlSet.create({
      data: {
        cardSetId,
        products: {
          create: products.map((p, i) => ({
            productType: p.productType as ProductType,
            productTypeOther: p.productTypeOther,
            maxQuantity: p.maxQuantity,
            estimatedPrintRun: p.estimatedPrintRun,
            boxesPerCase: normalizeBoxesPerCase(p.productType, p.boxesPerCase),
            sortOrder: i,
          })),
        },
      },
      select: {
        id: true,
        cardSetId: true,
        cardSet: { select: { name: true, imageUrl: true } },
        _count: { select: { products: true } },
      },
    });
    return {
      id: created.id,
      cardSetId: created.cardSetId,
      setName: created.cardSet.name,
      setImageUrl: created.cardSet.imageUrl,
      productCount: created._count.products,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EqlSetAlreadyExistsError();
    }
    throw error;
  }
}

// Replaces this set's product list: rows carrying an existing `id` are
// updated in place, rows without one are created, and existing rows not
// present in `products` are deleted — cascading any EqlResult logged
// against them. The admin client is expected to confirm() that loss with
// the user before calling this when removing a row that already has
// results (see getEqlSetAdminDetail below, which reports each product's
// own result count so the client can word that warning accurately).
export async function updateEqlSet(
  eqlSetId: string,
  products: EqlProductInput[]
): Promise<EqlSetListRow | null> {
  const existing = await prisma.eqlSet.findUnique({
    where: { id: eqlSetId },
    select: { id: true, products: { select: { id: true } } },
  });
  if (!existing) return null;

  const keepIds = new Set(products.filter((p) => p.id).map((p) => p.id!));
  const removeIds = existing.products.map((p) => p.id).filter((id) => !keepIds.has(id));

  await prisma.$transaction([
    ...(removeIds.length > 0
      ? [prisma.eqlProduct.deleteMany({ where: { id: { in: removeIds } } })]
      : []),
    ...products.map((p, i) =>
      p.id
        ? prisma.eqlProduct.update({
            where: { id: p.id },
            data: {
              productType: p.productType as ProductType,
              productTypeOther: p.productTypeOther,
              maxQuantity: p.maxQuantity,
              estimatedPrintRun: p.estimatedPrintRun,
              boxesPerCase: normalizeBoxesPerCase(p.productType, p.boxesPerCase),
              sortOrder: i,
            },
          })
        : prisma.eqlProduct.create({
            data: {
              eqlSetId,
              productType: p.productType as ProductType,
              productTypeOther: p.productTypeOther,
              maxQuantity: p.maxQuantity,
              estimatedPrintRun: p.estimatedPrintRun,
              boxesPerCase: normalizeBoxesPerCase(p.productType, p.boxesPerCase),
              sortOrder: i,
            },
          })
    ),
  ]);

  const updated = await prisma.eqlSet.findUniqueOrThrow({
    where: { id: eqlSetId },
    select: {
      id: true,
      cardSetId: true,
      cardSet: { select: { name: true, imageUrl: true } },
      _count: { select: { products: true } },
    },
  });
  return {
    id: updated.id,
    cardSetId: updated.cardSetId,
    setName: updated.cardSet.name,
    setImageUrl: updated.cardSet.imageUrl,
    productCount: updated._count.products,
  };
}

export async function deleteEqlSet(id: string): Promise<boolean> {
  const existing = await prisma.eqlSet.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.eqlSet.delete({ where: { id } });
  return true;
}

export interface EqlAdminProductRow extends EqlProductRow {
  productType: string;
  productTypeOther: string | null;
  resultCount: number;
}

// Full detail for the admin edit modal — includes raw productType/
// productTypeOther (not just the display label) and each product's own
// result count, so the client can word the delete-row confirm() warning
// accurately ("removing this will also delete N logged results").
export async function getEqlSetAdminDetail(eqlSetId: string): Promise<{
  id: string;
  cardSetId: string;
  setName: string;
  products: EqlAdminProductRow[];
} | null> {
  const set = await prisma.eqlSet.findUnique({
    where: { id: eqlSetId },
    select: {
      id: true,
      cardSetId: true,
      cardSet: { select: { name: true } },
      products: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          productType: true,
          productTypeOther: true,
          maxQuantity: true,
          estimatedPrintRun: true,
          boxesPerCase: true,
          _count: { select: { results: true } },
        },
      },
    },
  });
  if (!set) return null;

  return {
    id: set.id,
    cardSetId: set.cardSetId,
    setName: set.cardSet.name,
    products: set.products.map((p) => ({
      ...shapeProduct(p),
      productType: p.productType,
      productTypeOther: p.productTypeOther,
      resultCount: p._count.results,
    })),
  };
}

export interface EqlLogEntry {
  id: string;
  name: string;
  quantity: number;
  productLabel: string;
  createdAt: string;
}

export interface EqlSetDetail {
  id: string;
  setName: string;
  setImageUrl: string | null;
  products: EqlProductRow[];
  successCount: number;
  failCount: number;
  // Total boxes represented by every SUCCESS result: a plain box-type
  // option's quantity counts directly, a CASE option's quantity is
  // multiplied by its own boxesPerCase.
  boxesWon: number;
  successLog: EqlLogEntry[];
  failedLog: EqlLogEntry[];
}

// The public pop-up's full payload — set info, its EQL options, and both
// status logs (small expected volume, so no pagination — same call as
// recentPulls elsewhere in this app).
export async function getEqlSetDetail(eqlSetId: string): Promise<EqlSetDetail | null> {
  const set = await prisma.eqlSet.findUnique({
    where: { id: eqlSetId },
    select: {
      id: true,
      cardSet: { select: { name: true, imageUrl: true } },
      products: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, productType: true, productTypeOther: true, maxQuantity: true, estimatedPrintRun: true, boxesPerCase: true },
      },
      results: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          status: true,
          createdAt: true,
          eqlProduct: { select: { productType: true, productTypeOther: true, boxesPerCase: true } },
        },
      },
    },
  });
  if (!set) return null;

  const toLogEntry = (r: (typeof set.results)[number]): EqlLogEntry => ({
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    productLabel: getProductLabel(r.eqlProduct.productType, r.eqlProduct.productTypeOther),
    createdAt: r.createdAt.toISOString(),
  });

  const successResults = set.results.filter((r) => r.status === "SUCCESS");
  const successLog = successResults.map(toLogEntry);
  const failedLog = set.results.filter((r) => r.status === "FAILED").map(toLogEntry);
  const boxesWon = successResults.reduce((sum, r) => sum + r.quantity * (r.eqlProduct.boxesPerCase ?? 1), 0);

  return {
    id: set.id,
    setName: set.cardSet.name,
    setImageUrl: set.cardSet.imageUrl,
    products: set.products.map(shapeProduct),
    successCount: successLog.length,
    failCount: failedLog.length,
    boxesWon,
    successLog,
    failedLog,
  };
}

export class EqlProductNotFoundError extends Error {
  constructor() {
    super("This EQL option couldn't be found.");
  }
}

export class EqlQuantityOutOfRangeError extends Error {
  constructor(label: string, max: number) {
    super(`Quantity for ${label} must be between 1 and ${max}.`);
  }
}

// Validates and creates one EqlResult row per entry — every row the Track
// form had a Selected/Not Selected result chosen for, all sharing one
// `name` — so a single submission can cover several options at once
// (e.g. both Hobby Box and Hobby Case) while still producing one row per
// option, each counting as 1 toward the set's totals. Each entry's own
// product/maxQuantity is re-derived server-side rather than trusting a
// client-sent max. Returns the full refreshed detail payload.
export async function createEqlResults(
  eqlSetId: string,
  input: {
    entries: { eqlProductId: string; quantity: number; status: "SUCCESS" | "FAILED" }[];
    name: string;
    userId: string | null;
  }
): Promise<EqlSetDetail> {
  if (input.entries.length === 0) {
    throw new EqlProductNotFoundError();
  }

  const products = await prisma.eqlProduct.findMany({
    where: { id: { in: input.entries.map((e) => e.eqlProductId) } },
    select: { id: true, eqlSetId: true, maxQuantity: true, productType: true, productTypeOther: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const entry of input.entries) {
    const product = productById.get(entry.eqlProductId);
    if (!product || product.eqlSetId !== eqlSetId) {
      throw new EqlProductNotFoundError();
    }
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > product.maxQuantity) {
      throw new EqlQuantityOutOfRangeError(getProductLabel(product.productType, product.productTypeOther), product.maxQuantity);
    }
  }

  await prisma.eqlResult.createMany({
    data: input.entries.map((entry) => ({
      eqlSetId,
      eqlProductId: entry.eqlProductId,
      quantity: entry.quantity,
      status: entry.status,
      name: input.name,
      userId: input.userId,
    })),
  });

  const detail = await getEqlSetDetail(eqlSetId);
  if (!detail) throw new Error("EQL set vanished during result creation");
  return detail;
}

export interface UserEqlStats {
  attempts: number;
  successCount: number;
  failCount: number;
}

// A signed-in user's own aggregate stats across every set — shown at the
// top right of the public EQL Tracker page.
export async function getUserEqlStats(userId: string): Promise<UserEqlStats> {
  const counts = await prisma.eqlResult.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  const successCount = counts.find((c) => c.status === "SUCCESS")?._count._all ?? 0;
  const failCount = counts.find((c) => c.status === "FAILED")?._count._all ?? 0;
  return { attempts: successCount + failCount, successCount, failCount };
}
