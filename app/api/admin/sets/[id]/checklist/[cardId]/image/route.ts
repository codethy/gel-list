// app/api/admin/sets/[id]/checklist/[cardId]/image/route.ts
//
// PATCH — sets (or clears) one checklist row's admin-curated default image.
// Separate from the main checklist card PATCH route so updating just the
// image doesn't require resending every other field.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId, cardId } = await params;

  const existing = await prisma.checklistCard.findUnique({
    where:  { id: cardId },
    select: { cardSetId: true },
  });
  if (!existing || existing.cardSetId !== setId) {
    return NextResponse.json({ error: "Card not found in this set" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const imageUrl = body?.imageUrl;
  if (imageUrl !== null && typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl must be a string or null" }, { status: 400 });
  }

  const card = await prisma.checklistCard.update({
    where: { id: cardId },
    data:  { imageUrl: imageUrl || null },
    select: { id: true, imageUrl: true },
  });

  return NextResponse.json({ card });
}
