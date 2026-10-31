// app/api/admin/sets/[id]/products/[productId]/packs/route.ts
//
// PATCH — replaces a product's whole list of pack kinds (see
// ProductPackKind in prisma/schema.prisma) in one go: delete everything
// that was there, recreate from the submitted array, in order. Simpler
// than per-row CRUD for what's normally just 1-3 rows per product — see
// components/admin/AdminProductPacksModal.tsx.
// Body: { packKinds: [{ packsCount, cardsPerPack }, ...] }

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId, productId } = await params;

  const product = await prisma.setProduct.findUnique({
    where:  { id: productId },
    select: { cardSetId: true },
  });
  if (!product || product.cardSetId !== setId) {
    return NextResponse.json({ error: "Product not found in this set" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const rawKinds = Array.isArray(body?.packKinds) ? body.packKinds : null;
  if (!rawKinds) {
    return NextResponse.json({ error: "packKinds is required" }, { status: 400 });
  }

  const packKinds: { packsCount: number; cardsPerPack: number }[] = [];
  for (const kind of rawKinds) {
    const packsCount   = Number(kind?.packsCount);
    const cardsPerPack = Number(kind?.cardsPerPack);
    if (!Number.isFinite(packsCount) || packsCount <= 0) {
      return NextResponse.json({ error: "Each pack kind needs a positive number of packs" }, { status: 400 });
    }
    if (!Number.isFinite(cardsPerPack) || cardsPerPack <= 0) {
      return NextResponse.json({ error: "Each pack kind needs a positive number of cards per pack" }, { status: 400 });
    }
    packKinds.push({ packsCount: Math.round(packsCount), cardsPerPack: Math.round(cardsPerPack) });
  }

  await prisma.$transaction([
    prisma.productPackKind.deleteMany({ where: { setProductId: productId } }),
    ...(packKinds.length > 0
      ? [
          prisma.productPackKind.createMany({
            data: packKinds.map((k, index) => ({ setProductId: productId, sortOrder: index, ...k })),
          }),
        ]
      : []),
  ]);

  const updated = await prisma.setProduct.findUniqueOrThrow({
    where:  { id: productId },
    select: {
      id: true,
      productType: true,
      productTypeOther: true,
      packKinds: { orderBy: { sortOrder: "asc" }, select: { id: true, packsCount: true, cardsPerPack: true } },
    },
  });

  revalidateSetDetailCache(setId);

  return NextResponse.json({
    product: {
      id:               updated.id,
      productType:      String(updated.productType),
      productTypeOther: updated.productTypeOther,
      packKinds:        updated.packKinds,
      packsPerUnit:     updated.packKinds.reduce((sum, k) => sum + k.packsCount, 0),
    },
  });
}
