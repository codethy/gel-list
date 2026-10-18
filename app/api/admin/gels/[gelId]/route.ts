// app/api/admin/gels/[gelId]/route.ts
//
// PATCH  — the developer edits any logged gel's details (no ownership check
//          — that's the point of this being admin-only). Doesn't touch
//          isVerified; verifying/rejecting is a separate action, see
//          app/api/admin/gels/[gelId]/verify/route.ts.
// DELETE — the developer removes any logged gel outright.
//
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gelId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gelId } = await params;

  const existing = await prisma.portfolioCard.findUnique({
    where:  { id: gelId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    loggedFor,
    acquisitionMethod,
    serialNumber,
    hitYear,
    hitMonth,
    hitCity,
    hitCountry,
    cardFrontImageUrl,
    cardBackImageUrl,
    seller,
    notes,
  } = body;

  const isInHand = loggedFor !== "OTHER";

  if (typeof cardFrontImageUrl !== "string" || !cardFrontImageUrl) {
    return NextResponse.json({ error: "A card front image is required" }, { status: 400 });
  }
  if (!isInHand && (typeof notes !== "string" || !notes.trim())) {
    return NextResponse.json(
      { error: "Please add a note describing where you saw this card pulled" },
      { status: 400 }
    );
  }

  const portfolioCard = await prisma.portfolioCard.update({
    where: { id: gelId },
    // Deliberately doesn't mention productType/productTypeOther — this
    // admin quick-edit form doesn't have a "Which Product" field, and
    // Prisma leaves a column untouched when it's absent from `data`, so
    // omitting it here preserves whatever was set via the user-facing
    // AddGelModal rather than silently wiping it on every admin edit.
    data: {
      isInHand,
      acquisitionMethod:
        typeof acquisitionMethod === "string" ? (acquisitionMethod as never) : null,
      serialNumber: typeof serialNumber === "number" ? serialNumber : null,
      hitYear:      typeof hitYear      === "number" ? hitYear      : null,
      hitMonth:     typeof hitMonth     === "number" ? hitMonth     : null,
      hitCity:      typeof hitCity      === "string" ? hitCity      : null,
      hitCountry:   typeof hitCountry   === "string" ? hitCountry   : null,
      cardFrontImageUrl: typeof cardFrontImageUrl === "string" ? cardFrontImageUrl : null,
      cardBackImageUrl:  typeof cardBackImageUrl  === "string" ? cardBackImageUrl  : null,
      seller: typeof seller === "string" ? seller : null,
      notes:  typeof notes  === "string" ? notes  : null,
    },
    select: { id: true, isInHand: true, isVerified: true },
  });

  return NextResponse.json({ gel: portfolioCard });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ gelId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gelId } = await params;

  const existing = await prisma.portfolioCard.findUnique({
    where:  { id: gelId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

  try {
    await prisma.portfolioCard.delete({ where: { id: gelId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "This gel has transfer history and can't be deleted." },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
