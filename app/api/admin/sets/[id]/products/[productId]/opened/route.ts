// app/api/admin/sets/[id]/products/[productId]/opened/route.ts
//
// PATCH — manually adds to or subtracts from a product's "opened" total,
// on top of the sum of every user's own logged ProductOpening.quantity —
// see SetProduct.adminOpenedAdjustment in prisma/schema.prisma and
// getPacksOpenedGlobal in lib/data/productOpenings.ts, which is what
// actually applies this adjustment everywhere the total is shown (this
// admin page's Products table, and the public "X Packs Opened" box).
// Body: { delta: number } — a non-zero integer; positive to add,
// negative to remove.

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
  const delta = Number(body?.delta);
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ error: "delta must be a non-zero whole number" }, { status: 400 });
  }

  const updated = await prisma.setProduct.update({
    where: { id: productId },
    data:  { adminOpenedAdjustment: { increment: delta } },
    select: { adminOpenedAdjustment: true },
  });

  const sum = await prisma.productOpening.aggregate({
    where: { setProductId: productId },
    _sum:  { quantity: true },
  });
  const openedQuantity = Math.max(0, (sum._sum.quantity ?? 0) + updated.adminOpenedAdjustment);

  revalidateSetDetailCache(setId);

  return NextResponse.json({ openedQuantity });
}
