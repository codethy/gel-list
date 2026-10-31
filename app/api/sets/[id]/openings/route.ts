// app/api/sets/[id]/openings/route.ts
//
// POST — saves the signed-in user's "I opened N of this product" counts
// for this set (see ProductOpening in prisma/schema.prisma), from the "Log
// it here" form on the set page. Body: { entries: [{ setProductId,
// quantity, isBreak }, ...] }. Returns the fresh set-wide summary so the
// "X Packs Opened" box and breakdown modal can update immediately.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getPacksOpenedSummary, saveProductOpening } from "@/lib/data/productOpenings";
import { revalidateSetDetailCache } from "@/lib/data/sets";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: setId } = await params;

  const cardSet = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true } });
  if (!cardSet) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const entries = Array.isArray(body?.entries) ? body.entries : null;
  if (!entries) {
    return NextResponse.json({ error: "entries is required" }, { status: 400 });
  }

  // Only ever touch products that actually belong to this set.
  const validProductIds = new Set(
    (await prisma.setProduct.findMany({ where: { cardSetId: setId }, select: { id: true } })).map((p) => p.id)
  );

  for (const entry of entries) {
    const setProductId = entry?.setProductId;
    const quantity      = Number(entry?.quantity);
    const isBreak       = Boolean(entry?.isBreak);

    if (typeof setProductId !== "string" || !validProductIds.has(setProductId)) continue;
    if (!Number.isFinite(quantity) || quantity < 0) continue;

    await saveProductOpening(user.id, setId, setProductId, Math.round(quantity), isBreak);
  }

  // totalPacksOpened/totalCardsPulled/each product's totalQuantity are
  // part of the cached global packsOpened half — every other viewer's
  // next load needs this too, not just this request's own response.
  revalidateSetDetailCache(setId);

  const summary = await getPacksOpenedSummary(setId, user.id);
  return NextResponse.json({ summary });
}
