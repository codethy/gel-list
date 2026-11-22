// app/api/admin/sets/[id]/purchase-locations/route.ts
//
// POST — adds one label (e.g. "Walgreens") to a set's "Where did you buy
// the product?" catalog (SetPurchaseLocation). This is what populates
// that dropdown in the Log a Gel form for this set — auto-seeded with
// defaults the first time it's needed (see lib/data/purchaseLocations.ts),
// editable by the admin from here on.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId } = await params;

  const cardSet = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true } });
  if (!cardSet) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "Please enter a label" }, { status: 400 });
  }

  const existing = await prisma.setPurchaseLocation.findFirst({
    where:  { cardSetId: setId, label },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "This option is already in this set's list" }, { status: 409 });
  }

  const created = await prisma.setPurchaseLocation.create({
    data:   { cardSetId: setId, label },
    select: { id: true, label: true },
  });

  revalidateSetDetailCache(setId);

  return NextResponse.json({ location: created });
}
