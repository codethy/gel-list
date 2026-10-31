// app/api/admin/sets/[id]/products/[productId]/route.ts
//
// DELETE — removes one product from a set's catalog. This only affects
// what's offered in the "Which Product" dropdown going forward; it doesn't
// touch any PortfolioCard that already recorded this product type (that
// value lives directly on the gel, not as a reference to this row).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId, productId } = await params;

  const product = await prisma.setProduct.findUnique({
    where: { id: productId },
    select: { cardSetId: true },
  });
  if (!product || product.cardSetId !== setId) {
    return NextResponse.json({ error: "Product not found in this set" }, { status: 404 });
  }

  await prisma.setProduct.delete({ where: { id: productId } });
  revalidateSetDetailCache(setId);

  return NextResponse.json({ success: true });
}
