// app/api/admin/sets/[id]/purchase-locations/[locationId]/route.ts
//
// DELETE — removes one option from a set's "Where did you buy the
// product?" catalog. Only affects the dropdown going forward — any gel
// that already recorded this value keeps it (PortfolioCard.purchaseLocation
// is plain text, not a reference to this row).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId, locationId } = await params;

  const location = await prisma.setPurchaseLocation.findUnique({
    where:  { id: locationId },
    select: { cardSetId: true },
  });
  if (!location || location.cardSetId !== setId) {
    return NextResponse.json({ error: "Option not found in this set" }, { status: 404 });
  }

  await prisma.setPurchaseLocation.delete({ where: { id: locationId } });
  revalidateSetDetailCache(setId);

  return NextResponse.json({ success: true });
}
